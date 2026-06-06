#!/usr/bin/env node
/**
 * Lucy daily market brief — markdown → HTML report + archive index.
 * Thay cho md_to_html.py + gen_index.py (full Node/JS stack, dùng `marked` GFM).
 *
 * Dùng:
 *   node gen_brief.mjs report <md_path> <summary_file> <out_html> [date_str]
 *   node gen_brief.mjs index
 *
 * Config qua env (có default khớp setup cũ):
 *   LUCY_WEB_ROOT   = /var/www/lucy-reports
 *   (archive = $LUCY_WEB_ROOT/archive, index = $LUCY_WEB_ROOT/index.html)
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

// ---------- mode: index ----------

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; // getDay(): 0=CN

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

function buildIndex() {
  let files = [];
  if (fs.existsSync(ARCHIVE_DIR)) {
    for (const fn of fs.readdirSync(ARCHIVE_DIR)) {
      const m = fn.match(/^brief-(\d{4}-\d{2}-\d{2})(?:-(am|pm))?\.html$/);
      if (m) files.push([m[1], m[2] || '', fn]);
    }
  }
  // mới nhất lên đầu: ngày giảm dần, trong cùng ngày thì chiều (pm) trước sáng (am)
  const rank = (s) => (s === 'pm' ? 2 : s === 'am' ? 1 : 0);
  files.sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? 1 : -1) : rank(b[1]) - rank(a[1])));

  const cards = files.map(([dateStr, sess, fn]) => {
    let dayLabel = dateStr, weekday = '';
    const dm = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dm) {
      const dt = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
      dayLabel = `${dm[3]}/${dm[2]}/${dm[1]}`;
      weekday = WEEKDAYS[dt.getDay()];
    }
    const sessLabel = sess === 'pm' ? '🌆 Chiều' : sess === 'am' ? '🌅 Sáng' : '';
    const summary = extractSummary(path.join(ARCHIVE_DIR, fn));
    return `
        <a class="report-card" href="archive/${fn}">
          <div class="card-date">
            <span class="card-weekday">${weekday}${sessLabel ? ' · ' + sessLabel : ''}</span>
            <span class="card-day">${dayLabel}</span>
          </div>
          <div class="card-body">
            <div class="card-title">📊 Báo cáo thị trường${sessLabel ? ' — ' + sessLabel : ''}</div>
            <div class="card-preview">${summary || 'Crypto · Vàng · Chứng khoán · Macro'}</div>
          </div>
          <div class="card-arrow">→</div>
        </a>`;
  });

  const latestLink = files.length
    ? `<a class="latest-btn" href="archive/${files[0][2]}">📈 Xem báo cáo mới nhất (${files[0][0]})</a>`
    : '';
  const { gen: now } = fmtDateParts(new Date());
  const cardsHtml = cards.length ? cards.join('\n') : '<p class="empty">Chưa có báo cáo nào.</p>';

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📊 Lucy Market Reports — Archive</title>
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
  .container { max-width:780px; margin:0 auto; padding:30px 20px 64px; }
  .latest-btn {
    display:block; text-align:center; text-decoration:none;
    background:linear-gradient(135deg,rgba(90,169,255,0.16),rgba(46,204,113,0.12));
    border:1px solid rgba(90,169,255,0.38); border-radius:14px;
    padding:17px; color:var(--accent-soft); font-weight:700; font-size:1.02rem;
    margin-bottom:30px; transition:all 0.2s;
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
  .card-weekday { font-size:0.72rem; color:var(--up); font-weight:800; text-transform:uppercase; }
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
    .container { padding:22px 14px 44px; }
    .card-date { min-width:56px; padding-right:12px; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>📊 Lucy Market Reports</h1>
  <div class="sub">Báo cáo thị trường hàng ngày · Crypto · Vàng · Chứng khoán · Macro</div>
  <div class="updated">Cập nhật: ${now}</div>
</div>
<div class="container">
  ${latestLink}
  <div class="section-label">📚 Lịch sử báo cáo (${files.length})</div>
  ${cardsHtml}
</div>
<div class="footer">
  Tự động bởi <span class="sig">Lucy</span> · Lưu trữ để đối chiếu · Không phải lời khuyên đầu tư
</div>
</body>
</html>`;

  fs.mkdirSync(WEB_ROOT, { recursive: true });
  fs.writeFileSync(INDEX_OUT, html, 'utf8');
  console.log(`INDEX OK: ${INDEX_OUT} (${files.length} reports)`);
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
