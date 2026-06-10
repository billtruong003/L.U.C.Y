#!/usr/bin/env node
/**
 * Lucy reports — markdown → HTML report + archive index (đa loại, dạng tab module hoá).
 * Thay cho md_to_html.py + gen_index.py (full Node/JS stack, dùng `marked` GFM).
 *
 * Dùng:
 *   node gen_brief.mjs report <md_path> <summary_file> <out_html> [date_str]
 *   node gen_brief.mjs index
 *
 * Config qua env (có default khớp setup cũ):
 *   LUCY_WEB_ROOT   = /var/www/lucy-reports
 *   (archive = $LUCY_WEB_ROOT/archive, index = $LUCY_WEB_ROOT/index.html)
 *
 * ➕ Thêm loại report mới (vd "game", "crypto-deep"...): chỉ cần thêm 1 entry vào
 *    REPORT_TYPES bên dưới (key + regex tên file + nhãn tab + tiêu đề card). Index tự sinh tab.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = process.env.LUCY_WEB_ROOT || '/var/www/lucy-reports';
const ARCHIVE_DIR = path.join(WEB_ROOT, 'archive');
const INDEX_OUT = path.join(WEB_ROOT, 'index.html');

const marked = new Marked({ gfm: true, breaks: false });

// ---------- helpers ----------

function pad2(n) { return String(n).padStart(2, '0'); }

function fmtDateParts(d) {
  const date = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const gen = `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${date}`;
  return { date, gen };
}

/** Bỏ dòng H1 đầu tiên (`# ...`) để không trùng tiêu đề header của template. */
function stripLeadingH1(md) {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    lines.splice(i, 1);
  }
  return lines.join('\n');
}

/** Tô màu phần trăm có dấu (+1.2% xanh, -3.4% đỏ) — chỉ chạm text, né bên trong tag. */
function colorizePct(html) {
  return html.replace(/(<[^>]+>)|([^<]+)/g, (full, tag, text) => {
    if (tag) return tag;
    return text.replace(/([+−-])(\d[\d.,]*)\s*%/g, (m, sign, num) => {
      const neg = sign === '-' || sign === '−';
      const cls = neg ? 'pct-down' : 'pct-up';
      return `<span class="${cls}">${sign}${num}%</span>`;
    });
  });
}

/** Bọc <table> trong .table-wrap để cuộn ngang trên mobile. */
function wrapTables(html) {
  return html
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
}

function renderMarkdown(md) {
  let html = marked.parse(md);
  html = wrapTables(html);
  html = colorizePct(html);
  return html;
}

/** Summary từ stdout của Claude: bullet '•' / '-' → markdown list, rồi render. */
function renderSummary(text) {
  const norm = text
    .trim()
    .split('\n')
    .map((l) => l.replace(/^\s*[•·]\s+/, '- '))
    .join('\n');
  return colorizePct(marked.parse(norm));
}

// ---------- mode: report ----------

function buildReport(mdPath, summaryFile, outHtml, dateStr) {
  const templatePath = path.join(__dirname, 'brief_template.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const md = fs.readFileSync(mdPath, 'utf8');
  const summary = fs.existsSync(summaryFile) ? fs.readFileSync(summaryFile, 'utf8') : '';

  const bodyHtml = renderMarkdown(stripLeadingH1(md));
  const summaryHtml = renderSummary(summary) || '<p>(chưa có tóm tắt)</p>';

  // date: ưu tiên arg (YYYY-MM-DD), fallback now
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
    .replace('{{BODY_HTML}}', bodyHtml);

  fs.writeFileSync(outHtml, html, 'utf8');
  console.log(`OK:${outHtml}`);
}

// ---------- mode: index (đa loại, tab module hoá) ----------

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; // getDay(): 0=CN

/**
 * Khai báo các LOẠI report. Thêm loại mới = thêm 1 object vào đây.
 *  - key:      id tab (chữ thường, không dấu)
 *  - tabLabel: nhãn nút tab
 *  - re:       regex tên file trong archive; group(1)=YYYY-MM-DD, group(2) optional=phiên (am/pm)
 *  - title:    (sess) => tiêu đề card
 *  - badge:    (sess) => nhãn phụ (vd 🌅 Sáng / 🌆 Chiều); '' nếu không có
 *  - preview:  text preview mặc định khi không trích được summary
 */
const REPORT_TYPES = [
  {
    key: 'market',
    tabLabel: '📊 Thị trường',
    re: /^brief-(\d{4}-\d{2}-\d{2})(?:-(am|pm))?\.html$/,
    title: (sess) => `📊 Báo cáo thị trường${sess ? ' — ' + (sess === 'pm' ? '🌆 Chiều' : '🌅 Sáng') : ''}`,
    badge: (sess) => (sess === 'pm' ? '🌆 Chiều' : sess === 'am' ? '🌅 Sáng' : ''),
    preview: 'Crypto · Vàng · Chứng khoán · Macro',
  },
  {
    key: 'tech',
    tabLabel: '🔬 Tech Digest',
    re: /^tech-(\d{4}-\d{2}-\d{2})\.html$/,
    title: () => '🔬 Tech Digest',
    badge: () => '',
    preview: 'AI · Dev · Game · Big Tech',
  },
];

function extractSummary(htmlPath) {
  try {
    const content = fs.readFileSync(htmlPath, 'utf8');
    const m = content.match(/<div class="summary-text content">([\s\S]*?)<\/div>/);
    if (m) {
      return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    }
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

function buildCard(type, dateStr, sess, fn) {
  const { dayLabel, weekday } = dayMeta(dateStr);
  const badge = type.badge(sess);
  const summary = extractSummary(path.join(ARCHIVE_DIR, fn));
  return `
        <a class="report-card" href="archive/${fn}">
          <div class="card-date">
            <span class="card-weekday">${weekday}${badge ? ' · ' + badge : ''}</span>
            <span class="card-day">${dayLabel}</span>
          </div>
          <div class="card-body">
            <div class="card-title">${type.title(sess)}</div>
            <div class="card-preview">${summary || type.preview}</div>
          </div>
          <div class="card-arrow">→</div>
        </a>`;
}

function buildIndex() {
  const all = fs.existsSync(ARCHIVE_DIR) ? fs.readdirSync(ARCHIVE_DIR) : [];
  const rankSess = (s) => (s === 'pm' ? 2 : s === 'am' ? 1 : 0);

  const tabBtns = [];
  const panels = [];
  let grandTotal = 0;

  REPORT_TYPES.forEach((type, ti) => {
    const files = [];
    for (const fn of all) {
      const m = fn.match(type.re);
      if (m) files.push([m[1], m[2] || '', fn]);
    }
    // mới nhất lên đầu: ngày giảm dần; trong cùng ngày pm trước am
    files.sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? 1 : -1) : rankSess(b[1]) - rankSess(a[1])));
    grandTotal += files.length;

    const cards = files.map(([dateStr, sess, fn]) => buildCard(type, dateStr, sess, fn));
    const latest = files.length
      ? `<a class="latest-btn" href="archive/${files[0][2]}">📈 Xem mới nhất (${files[0][0]})</a>`
      : '';
    const body = cards.length ? cards.join('\n') : '<p class="empty">Chưa có báo cáo nào.</p>';
    const active = ti === 0 ? ' active' : '';

    tabBtns.push(
      `<button class="tab-btn${active}" data-tab="${type.key}">${type.tabLabel}<span class="tab-count">${files.length}</span></button>`
    );
    panels.push(
      `<section class="tab-panel${active}" id="tab-${type.key}">
        ${latest}
        <div class="section-label">📚 Lịch sử (${files.length})</div>
        ${body}
      </section>`
    );
  });

  const { gen: now } = fmtDateParts(new Date());

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📊 Lucy Reports — Archive</title>
<style>
  :root {
    --bg:#0b0e14; --surface:#131822; --border:#262d3d; --accent:#5aa9ff;
    --accent-soft:#93c5ff; --up:#2ecc71; --gold:#ecc14a; --text:#e9eef5; --muted:#93a1b5;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body {
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',sans-serif;
    background:var(--bg); color:var(--text); line-height:1.6; min-height:100vh; font-size:16px;
  }
  .header {
    background:linear-gradient(135deg,#0b0e14,#141a26,#0b0e14);
    border-bottom:1px solid var(--border); padding:38px 24px 30px;
    text-align:center; position:relative; overflow:hidden;
  }
  .header::before {
    content:''; position:absolute; inset:0;
    background:radial-gradient(ellipse at 30% 40%,rgba(90,169,255,0.10),transparent 60%),
               radial-gradient(ellipse at 70% 60%,rgba(46,204,113,0.07),transparent 50%);
  }
  .header h1 {
    font-size:1.9rem; font-weight:800;
    background:linear-gradient(90deg,var(--accent-soft),var(--up));
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text; position:relative;
  }
  .header .sub { color:var(--muted); font-size:0.92rem; margin-top:8px; position:relative; }
  .header .updated { color:var(--muted); font-size:0.76rem; margin-top:10px; position:relative; }
  .container { max-width:780px; margin:0 auto; padding:24px 20px 64px; }
  /* Tabs */
  .tabs {
    display:flex; gap:8px; margin-bottom:24px; flex-wrap:wrap;
    border-bottom:1px solid var(--border); padding-bottom:0;
  }
  .tab-btn {
    display:inline-flex; align-items:center; gap:8px; cursor:pointer;
    background:transparent; border:none; border-bottom:2px solid transparent;
    color:var(--muted); font-size:0.98rem; font-weight:700; padding:12px 14px;
    font-family:inherit; transition:all 0.18s; margin-bottom:-1px;
  }
  .tab-btn:hover { color:var(--text); }
  .tab-btn.active { color:var(--accent-soft); border-bottom-color:var(--accent); }
  .tab-count {
    font-size:0.72rem; background:var(--surface); border:1px solid var(--border);
    color:var(--muted); border-radius:999px; padding:1px 8px; font-weight:600;
  }
  .tab-btn.active .tab-count { color:var(--accent-soft); border-color:rgba(90,169,255,0.4); }
  .tab-panel { display:none; }
  .tab-panel.active { display:block; }
  .latest-btn {
    display:block; text-align:center; text-decoration:none;
    background:linear-gradient(135deg,rgba(90,169,255,0.16),rgba(46,204,113,0.12));
    border:1px solid rgba(90,169,255,0.38); border-radius:14px;
    padding:17px; color:var(--accent-soft); font-weight:700; font-size:1.02rem;
    margin-bottom:26px; transition:all 0.2s;
  }
  .latest-btn:hover { background:rgba(90,169,255,0.24); transform:translateY(-1px); }
  .section-label {
    font-size:0.76rem; text-transform:uppercase; letter-spacing:1.5px;
    color:var(--muted); font-weight:700; margin-bottom:15px; padding-left:4px;
  }
  .report-card {
    display:flex; align-items:center; gap:16px; text-decoration:none;
    background:var(--surface); border:1px solid var(--border); border-radius:14px;
    padding:16px 18px; margin-bottom:13px; transition:all 0.2s;
  }
  .report-card:hover {
    border-color:var(--accent); transform:translateY(-1px);
    box-shadow:0 6px 20px rgba(0,0,0,0.35);
  }
  .card-date {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    min-width:66px; padding-right:16px; border-right:1px solid var(--border);
  }
  .card-weekday { font-size:0.72rem; color:var(--up); font-weight:800; text-transform:uppercase; text-align:center; }
  .card-day { font-size:0.86rem; color:var(--text); font-weight:600; margin-top:3px; white-space:nowrap; }
  .card-body { flex:1; min-width:0; }
  .card-title { font-size:0.98rem; font-weight:700; color:var(--text); margin-bottom:4px; }
  .card-preview {
    font-size:0.82rem; color:var(--muted);
    overflow:hidden; text-overflow:ellipsis; display:-webkit-box;
    -webkit-line-clamp:2; -webkit-box-orient:vertical;
  }
  .card-arrow { color:var(--accent); font-size:1.35rem; font-weight:700; }
  .empty { text-align:center; color:var(--muted); padding:40px; }
  .footer { text-align:center; padding:26px; color:var(--muted); font-size:0.78rem; border-top:1px solid var(--border); }
  .footer .sig { color:var(--accent); font-weight:600; }
  @media (max-width:600px) {
    body { font-size:15px; }
    .header { padding:26px 16px 22px; }
    .header h1 { font-size:1.5rem; }
    .container { padding:18px 14px 44px; }
    .card-date { min-width:56px; padding-right:12px; }
    .tab-btn { padding:10px 10px; font-size:0.9rem; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>📊 Lucy Reports</h1>
  <div class="sub">Trung tâm báo cáo hàng ngày · Thị trường · Công nghệ</div>
  <div class="updated">Cập nhật: ${now} · Tổng ${grandTotal} báo cáo</div>
</div>
<div class="container">
  <nav class="tabs">
    ${tabBtns.join('\n    ')}
  </nav>
  ${panels.join('\n  ')}
</div>
<div class="footer">
  Tự động bởi <span class="sig">Lucy</span> · Lưu trữ để đối chiếu · Không phải lời khuyên đầu tư
</div>
<script>
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var panel = document.getElementById('tab-' + key);
      if (panel) panel.classList.add('active');
      if (history.replaceState) history.replaceState(null, '', '#' + key);
    });
  });
  // mở đúng tab theo hash (vd #tech)
  (function () {
    var h = (location.hash || '').replace('#', '');
    if (h) {
      var btn = document.querySelector('.tab-btn[data-tab="' + h + '"]');
      if (btn) btn.click();
    }
  })();
</script>
</body>
</html>`;

  fs.mkdirSync(WEB_ROOT, { recursive: true });
  fs.writeFileSync(INDEX_OUT, html, 'utf8');
  console.log(`INDEX OK: ${INDEX_OUT} (${grandTotal} reports, ${REPORT_TYPES.length} tabs)`);
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
} else {
  console.error('Usage: gen_brief.mjs <report|index> ...');
  process.exit(1);
}
