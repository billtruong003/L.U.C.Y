#!/usr/bin/env node
/**
 * Lucy reports — markdown → HTML report + archive index (modular, có chart).
 *
 * Dùng:
 *   node gen_brief.mjs report <md_path> <summary_file> <out_html> [date_str]
 *   node gen_brief.mjs index
 *   node gen_brief.mjs deploy        # chỉ copy assets sang web root
 *
 * Config qua env:
 *   LUCY_WEB_ROOT = /var/www/lucy-reports   (archive/, assets/, data/, index.html)
 *
 * Chart: đọc $LUCY_WEB_ROOT/data/market-series.json (cron ghi qua lucy_data.mjs),
 * tự render sparkline cho từng metric. Không có dữ liệu → bỏ section, không lỗi.
 *
 * ➕ Thêm loại report mới: thêm 1 entry vào REPORT_TYPES.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { loadData, buildSeriesArrays } from './lucy_data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = process.env.LUCY_WEB_ROOT || '/var/www/lucy-reports';
const ARCHIVE_DIR = path.join(WEB_ROOT, 'archive');
const ASSETS_SRC = path.join(__dirname, 'assets');
const ASSETS_DST = path.join(WEB_ROOT, 'assets');
const DATA_DIR = path.join(WEB_ROOT, 'data');
const INDEX_OUT = path.join(WEB_ROOT, 'index.html');

const marked = new Marked({ gfm: true, breaks: false });

// ---------- helpers ----------

function pad2(n) { return String(n).padStart(2, '0'); }

function fmtDateParts(d) {
  const date = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const gen = `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${date}`;
  return { date, gen };
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Format số phía server (khớp charts.js fmtVal). */
function fmtVal(v, fmt) {
  if (v == null || isNaN(v)) return '–';
  const abs = Math.abs(v);
  if (fmt === 'pct') return v.toFixed(2) + '%';
  if (fmt === 'usd') {
    if (abs >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (abs >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function pill(pct) {
  const cls = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat';
  const sign = pct > 0 ? '+' : '';
  const arrow = pct > 0.05 ? '▲' : pct < -0.05 ? '▼' : '•';
  return `<span class="pill ${cls}">${arrow} ${sign}${pct.toFixed(2)}%</span>`;
}

/** Deploy assets nguồn → web root (idempotent, mỗi lần gen tự cập nhật). */
function deployAssets() {
  if (!fs.existsSync(ASSETS_SRC)) return;
  fs.mkdirSync(ASSETS_DST, { recursive: true });
  for (const fn of fs.readdirSync(ASSETS_SRC)) {
    fs.copyFileSync(path.join(ASSETS_SRC, fn), path.join(ASSETS_DST, fn));
  }
}

function stripLeadingH1(md) {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) lines.splice(i, 1);
  return lines.join('\n');
}

function colorizePct(html) {
  return html.replace(/(<[^>]+>)|([^<]+)/g, (full, tag, text) => {
    if (tag) return tag;
    return text.replace(/([+−-])(\d[\d.,]*)\s*%/g, (m, sign, num) => {
      const neg = sign === '-' || sign === '−';
      return `<span class="${neg ? 'pct-down' : 'pct-up'}">${sign}${num}%</span>`;
    });
  });
}

function wrapTables(html) {
  return html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
}

function renderMarkdown(md) { return colorizePct(wrapTables(marked.parse(md))); }

function renderSummary(text) {
  const norm = text.trim().split('\n').map((l) => l.replace(/^\s*[•·]\s+/, '- ')).join('\n');
  return colorizePct(marked.parse(norm));
}

// ---------- chart section (report) ----------

/**
 * Trả { sectionHtml, seriesJson } từ data series.
 * seriesJson: mảng gọn cho charts.js (key, meta{color,fmt}, points).
 * Nếu không đủ dữ liệu (mọi metric <2 điểm) → sectionHtml = '' (bỏ section).
 */
function buildChartSection(days = 14) {
  const data = loadData();
  const arrays = buildSeriesArrays(data, days);
  const drawable = arrays.filter((m) => m.points.length >= 2);
  if (!drawable.length) return { sectionHtml: '', seriesJson: '[]' };

  const cards = drawable.map((m) => {
    const last = fmtVal(m.last, m.meta.fmt);
    const span = m.points.length;
    return `
        <div class="chart-card">
          <div class="chart-card-top">
            <div>
              <div class="chart-card-label">${escAttr(m.meta.label)}</div>
              <div class="chart-card-unit">${escAttr(m.meta.unit || '')}</div>
            </div>
            ${pill(m.changePct)}
          </div>
          <div class="chart-card-val">${last}</div>
          <div class="lucy-spark" id="sp-${escAttr(m.key)}" data-key="${escAttr(m.key)}"></div>
          <div class="chart-meta">
            <span class="dim">${span} phiên · so phiên trước ${m.dayChangePct >= 0 ? '+' : ''}${m.dayChangePct.toFixed(2)}%</span>
          </div>
        </div>`;
  }).join('\n');

  const sectionHtml = `<div class="section" data-collapsible>
    <div class="section-header">
      <span class="section-icon">📈</span>
      <span class="section-title">Diễn biến ${days} phiên gần nhất</span>
      <span class="section-caret">▾</span>
    </div>
    <div class="section-body">
      <div class="chart-grid">
${cards}
      </div>
      <div class="chart-note">Dữ liệu tích luỹ tự động mỗi phiên · di chuột để xem chi tiết</div>
    </div>
  </div>`;

  const lite = drawable.map((m) => ({
    key: m.key,
    meta: { color: m.meta.color, fmt: m.meta.fmt, label: m.meta.label, unit: m.meta.unit },
    points: m.points,
  }));
  return { sectionHtml, seriesJson: JSON.stringify(lite) };
}

// ---------- mode: report ----------

function buildReport(mdPath, summaryFile, outHtml, dateStr) {
  const basename = path.basename(outHtml);
  // Chọn template theo loại report
  let templateFile = 'brief_template.html';
  if (basename.startsWith('tech-')) templateFile = 'tech_template.html';
  else if (basename.startsWith('vn-trending-')) templateFile = 'trend_template.html';
  deployAssets();
  const templatePath = path.join(__dirname, templateFile);
  const template = fs.readFileSync(templatePath, 'utf8');
  const md = fs.readFileSync(mdPath, 'utf8');
  const summary = fs.existsSync(summaryFile) ? fs.readFileSync(summaryFile, 'utf8') : '';

  const bodyHtml = renderMarkdown(stripLeadingH1(md));
  const summaryHtml = renderSummary(summary) || '<p>(chưa có tóm tắt)</p>';
  // chart thị trường chỉ áp cho report market (không lọt vào tech digest)
  const isMarket = path.basename(outHtml).startsWith('brief') || (path.basename(outHtml).startsWith('vn-') && !path.basename(outHtml).startsWith('vn-trending-'));
  const { sectionHtml, seriesJson } = isMarket ? buildChartSection(14) : { sectionHtml: '', seriesJson: '[]' };

  let d = new Date();
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, day] = dateStr.split('-').map(Number);
    d = new Date(y, m - 1, day, d.getHours(), d.getMinutes());
  }
  const { date, gen } = fmtDateParts(d);

  const html = template
    .replaceAll('{{DATE}}', date)
    .replaceAll('{{GENERATED_AT}}', gen)
    .replace('{{SUMMARY_HTML}}', summaryHtml)
    .replace('{{CHART_SECTION}}', sectionHtml)
    .replace('{{SERIES_JSON}}', seriesJson)
    .replace('{{BODY_HTML}}', bodyHtml);

  fs.writeFileSync(outHtml, html, 'utf8');
  console.log(`OK:${outHtml}`);
}

// ---------- mode: index ----------

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const REPORT_TYPES = [
  {
    key: 'market',
    tabLabel: '📊 Thị trường',
    re: /^brief-(\d{4}-\d{2}-\d{2})(?:-(am|pm))?\.html$/,
    title: (sess) => `📊 Báo cáo thị trường${sess ? ' — ' + (sess === 'pm' ? '🌆 Chiều' : '🌅 Sáng') : ''}`,
    badge: (sess) => (sess === 'pm' ? '🌆 Chiều' : sess === 'am' ? '🌅 Sáng' : ''),
    preview: 'Crypto · Vàng · Chứng khoán · Macro',
    chips: true,
  },
  {
    key: 'tech',
    tabLabel: '🔬 Tech Digest',
    re: /^tech-(\d{4}-\d{2}-\d{2})\.html$/,
    title: () => '🔬 Tech Digest',
    badge: () => '',
    preview: 'AI · Dev · Game · Big Tech',
    chips: false,
  },
  {
    key: 'vn',
    tabLabel: '📍 Thị trường VN',
    re: /^vn-(\d{4}-\d{2}-\d{2})(?:-(am|pm))?\.html$/,
    title: (sess) => `📍 Thị trường VN${sess ? ' — ' + (sess === 'pm' ? '🌆 Chiều' : '🌅 Sáng') : ''}`,
    badge: (sess) => (sess === 'pm' ? '🌆 Chiều' : sess === 'am' ? '🌅 Sáng' : ''),
    preview: 'Chứng khoán VN · Tin tức · Vĩ mô',
    chips: true,
  },

  {
    key: 'trend',
    tabLabel: '🔥 VN Trending',
    re: /^vn-trending-(\d{4}-\d{2}-\d{2})\.html$/,
    title: () => '🔥 VN Trending — Content Trends',
    badge: () => '',
    preview: 'Trending topics · Viral content · Data insights',
    chips: false,
  },
];

function extractSummary(htmlPath) {
  try {
    const content = fs.readFileSync(htmlPath, 'utf8');
    const m = content.match(/<div class="summary-text content">([\s\S]*?)<\/div>/);
    if (m) return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  } catch { /* ignore */ }
  return '';
}

function dayMeta(dateStr) {
  let dayLabel = dateStr, weekday = '';
  const dm = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dm) {
    const dt = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
    dayLabel = `${dm[3]}/${dm[2]}/${dm[1]}`;
    weekday = WEEKDAYS[dt.getDay()];
  }
  return { dayLabel, weekday };
}

/** Chip tín hiệu cho 1 ngày: so giá metric với phiên/ngày trước (data-driven). */
function buildChips(seriesData, dateStr, session) {
  const PICK = ['BTC', 'XAU', 'VNINDEX'];
  const dates = Object.keys(seriesData.series || {}).sort();
  const idx = dates.indexOf(dateStr);
  const dayVal = (dt, key) => {
    const day = seriesData.series[dt] || {};
    return (day.pm && day.pm[key] != null) ? day.pm[key] : (day.am && day.am[key] != null) ? day.am[key] : null;
  };
  const chips = [];
  for (const key of PICK) {
    const cur = dayVal(dateStr, key);
    if (cur == null) continue;
    let prev = null;
    for (let j = idx - 1; j >= 0; j--) { const v = dayVal(dates[j], key); if (v != null) { prev = v; break; } }
    if (prev == null) continue;
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    const cls = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : '';
    const sign = pct > 0 ? '+' : '';
    const label = (seriesData.metrics[key] && seriesData.metrics[key].label) || key;
    const short = key === 'VNINDEX' ? 'VNI' : key === 'XAU' ? 'Vàng' : key;
    chips.push(`<span class="chip ${cls}">${short} ${sign}${pct.toFixed(1)}%</span>`);
  }
  return chips.join('');
}

function buildCard(type, dateStr, sess, fn, seriesData, todayStr) {
  const { dayLabel, weekday } = dayMeta(dateStr);
  const badge = type.badge(sess);
  const summary = extractSummary(path.join(ARCHIVE_DIR, fn));
  const chipsHtml = type.chips ? buildChips(seriesData, dateStr, sess) : '';
  const isToday = dateStr === todayStr;
  const search = `${dayLabel} ${weekday} ${type.title(sess)} ${badge} ${summary}`.toLowerCase();
  return `
        <a class="report-card${isToday ? ' today' : ''}" href="archive/${fn}" data-search="${escAttr(search)}">
          <div class="card-date">
            <span class="card-weekday">${weekday}${badge ? ' · ' + badge : ''}</span>
            <span class="card-day">${dayLabel}</span>
          </div>
          <div class="card-body">
            <div class="card-title">${type.title(sess)}</div>
            <div class="card-preview">${summary || type.preview}</div>
            ${chipsHtml ? `<div class="card-chips">${chipsHtml}</div>` : ''}
          </div>
          <div class="card-arrow">→</div>
        </a>`;
}

/** Streak: số ngày liên tiếp (tính tới ngày mới nhất) có ít nhất 1 báo cáo market. */
function computeStreak(marketDates) {
  if (!marketDates.length) return 0;
  const set = new Set(marketDates);
  const sorted = [...set].sort();
  const top = sorted[sorted.length - 1];
  const [y, m, d] = top.split('-').map(Number);
  let cur = new Date(y, m - 1, d);
  let streak = 0;
  for (;;) {
    const key = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`;
    if (set.has(key)) { streak++; cur.setDate(cur.getDate() - 1); } else break;
  }
  return streak;
}

/** Overview chart cho index: vài metric chủ lực. */
function buildOverview(seriesData) {
  const arrays = buildSeriesArrays(seriesData, 14).filter((m) => m.points.length >= 2);
  const PICK = ['BTC', 'XAU', 'VNINDEX', 'SP500'];
  const chosen = PICK.map((k) => arrays.find((m) => m.key === k)).filter(Boolean);
  const list = chosen.length ? chosen : arrays.slice(0, 4);
  if (!list.length) return { html: '', seriesJson: '[]' };

  const cards = list.map((m) => `
        <div class="ov-card">
          <div class="ov-top">
            <span class="ov-label">${escAttr(m.meta.label)}</span>
            <span class="ov-val">${fmtVal(m.last, m.meta.fmt)}</span>
          </div>
          <div class="lucy-spark" id="ov-${escAttr(m.key)}" data-key="${escAttr(m.key)}"></div>
          <div class="chart-meta"><span class="dim">14 phiên</span>${pill(m.changePct)}</div>
        </div>`).join('\n');

  const html = `<div class="overview">
    <div class="overview-title">📈 Tổng quan 14 phiên</div>
    <div class="ov-grid">
${cards}
    </div>
  </div>`;
  const lite = list.map((m) => ({ key: m.key, meta: { color: m.meta.color, fmt: m.meta.fmt }, points: m.points }));
  return { html, seriesJson: JSON.stringify(lite) };
}

function buildIndex() {
  deployAssets();
  const all = fs.existsSync(ARCHIVE_DIR) ? fs.readdirSync(ARCHIVE_DIR) : [];
  const seriesData = loadData();
  const rankSess = (s) => (s === 'pm' ? 2 : s === 'am' ? 1 : 0);
  const todayStr = new Date().toISOString().slice(0, 10);

  const tabBtns = [];
  const panels = [];
  const manifest = {};
  let grandTotal = 0;
  let marketDates = [];

  REPORT_TYPES.forEach((type, ti) => {
    const files = [];
    for (const fn of all) {
      const m = fn.match(type.re);
      if (m) files.push([m[1], m[2] || '', fn]);
    }
    files.sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? 1 : -1) : rankSess(b[1]) - rankSess(a[1])));
    grandTotal += files.length;
    if (type.key === 'market') marketDates = files.map((f) => f[0]);
    manifest[type.key] = files.map((f) => f[2]); // newest -> oldest

    const cards = files.map(([dateStr, sess, fn]) => buildCard(type, dateStr, sess, fn, seriesData, todayStr));
    const latest = files.length ? `<a class="latest-btn" href="archive/${files[0][2]}">📈 Xem mới nhất (${files[0][0]})</a>` : '';
    const body = cards.length ? cards.join('\n') : '<p class="empty">Chưa có báo cáo nào.</p>';
    const active = ti === 0 ? ' active' : '';

    tabBtns.push(`<button class="tab-btn${active}" data-tab="${type.key}">${type.tabLabel}<span class="tab-count">${files.length}</span></button>`);
    panels.push(`<section class="tab-panel${active}" id="tab-${type.key}">
        ${latest}
        <div class="section-label">📚 Lịch sử (${files.length})</div>
        ${body}
        <div class="no-results">Không tìm thấy báo cáo nào khớp.</div>
      </section>`);
  });

  const streak = computeStreak(marketDates);
  const firstDate = marketDates.length ? dayMeta(marketDates[marketDates.length - 1]).dayLabel : '—';
  const { html: overviewHtml, seriesJson } = buildOverview(seriesData);
  const { gen: now } = fmtDateParts(new Date());

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0b0e14">
<title>📊 Lucy Reports — Archive</title>
<link rel="stylesheet" href="assets/theme.css">
<link rel="stylesheet" href="assets/index.css">
</head>
<body>
<div class="header">
  <div class="header-tools"><button class="icon-btn" data-action="theme" title="Đổi giao diện">◑</button></div>
  <h1>📊 Lucy Reports</h1>
  <div class="sub">Trung tâm báo cáo hàng ngày · Thị trường · Công nghệ</div>
  <div class="updated">Cập nhật: ${now} · Tổng ${grandTotal} báo cáo</div>
</div>
<div class="container">
  <div class="stats">
    <div class="stat-card"><div class="stat-num">${grandTotal}</div><div class="stat-label">Báo cáo</div></div>
    <div class="stat-card"><div class="stat-num">${streak}🔥</div><div class="stat-label">Ngày liên tiếp</div></div>
    <div class="stat-card"><div class="stat-num">${marketDates.length}</div><div class="stat-label">Phiên thị trường</div></div>
    <div class="stat-card"><div class="stat-num" style="font-size:1rem;padding-top:6px">${firstDate}</div><div class="stat-label">Bắt đầu</div></div>
  </div>

  ${overviewHtml}

  <div class="search-wrap">
    <span class="search-icon">🔍</span>
    <input id="search" type="search" placeholder="Tìm theo ngày, thứ, từ khoá…" autocomplete="off">
  </div>

  <nav class="tabs">
    ${tabBtns.join('\n    ')}
  </nav>
  ${panels.join('\n  ')}
</div>
<div class="footer">
  Tự động bởi <span class="sig">Lucy</span> · Lưu trữ để đối chiếu · Không phải lời khuyên đầu tư
</div>
<script>window.LUCY_SERIES = ${seriesJson};</script>
<script src="assets/charts.js"></script>
<script src="assets/index.js"></script>
</body>
</html>`;

  fs.mkdirSync(WEB_ROOT, { recursive: true });
  fs.writeFileSync(INDEX_OUT, html, 'utf8');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest), 'utf8');
  console.log(`INDEX OK: ${INDEX_OUT} (${grandTotal} reports, ${REPORT_TYPES.length} tabs, streak ${streak})`);
}

// ---------- CLI ----------

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'report') {
  const [mdPath, summaryFile, outHtml, dateStr] = rest;
  if (!mdPath || !summaryFile || !outHtml) {
    console.error('Usage: gen_brief.mjs report <md_path> <summary_file> <out_html> [date_str]');
    process.exit(1);
  }
  buildReport(mdPath, summaryFile, outHtml, dateStr);
} else if (mode === 'index') {
  buildIndex();
} else if (mode === 'deploy') {
  deployAssets();
  console.log(`ASSETS deployed → ${ASSETS_DST}`);
} else {
  console.error('Usage: gen_brief.mjs <report|index|deploy> ...');
  process.exit(1);
}
