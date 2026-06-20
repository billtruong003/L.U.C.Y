// template.mjs — render HTML data-driven cho cổng dự án Lucy (LP-2)
// Bám mockup lucy-portal-mockup.html (cockpit gold/cyan). KHÔNG nhúng project cứng.
// Input: { zones: [{ key, meta, projects: [validatedManifest...] }], generatedAt }

import { ZONE_META, ZONES } from './schema.mjs';

// status → class chấm + nhãn mũi tên (khớp .live/.static/.idea trong mockup)
const STATUS_DOT = { live: 'live', wip: 'idea', archived: 'static' };
const STATUS_LABEL = { live: 'live', wip: 'wip', archived: 'lưu' };

// accent zone → biến CSS màu (khớp :root mockup)
const ACCENT_VAR = {
  green: 'var(--green)', cyan: 'var(--cyan)', gold: 'var(--gold)', violet: 'var(--violet)',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 1 project = 1 item-card: title + status badge + desc + tags + link
function renderItem(p) {
  const dot = STATUS_DOT[p.status] ?? 'static';
  const tags = (p.tags ?? []).length
    ? `<div class="tags">${p.tags.map((t) => `<span class="tag-chip">${esc(t)}</span>`).join('')}</div>`
    : '';
  const desc = p.description ? `<div class="idesc">${esc(p.description)}</div>` : '';
  const href = esc(p.url);
  const badge = STATUS_LABEL[p.status] ?? p.status;
  return `      <a class="item" href="${href}">
        <div class="irow">
          <span class="dot ${dot}"></span>
          <span class="ittl">${esc(p.title)}</span>
          <span class="arrow">${esc(badge)} ↗</span>
        </div>${desc ? `\n        ${desc}` : ''}${tags ? `\n        ${tags}` : ''}
      </a>`;
}

function renderZone(zone) {
  const meta = zone.meta;
  const accent = ACCENT_VAR[meta.accent] ?? 'var(--gold)';
  const items = zone.projects.length
    ? zone.projects.map(renderItem).join('\n')
    : '      <div class="more">— chưa có mục nào trong khu này —</div>';
  return `    <section class="zone" style="--accent:${accent}">
      <div class="zhead">
        <span class="zico">${esc(meta.icon)}</span>
        <span class="zttl">${esc(meta.label)}</span>
        <span class="zpath">${esc(meta.path)}</span>
      </div>
      <div class="zdesc">${esc(meta.desc)}</div>
      <div class="items">
${items}
      </div>
    </section>`;
}

export function renderPage({ zones, generatedAt }) {
  // đảm bảo đủ 4 zone theo thứ tự ZONES, kể cả khi rỗng
  const byKey = new Map(zones.map((z) => [z.key, z]));
  const ordered = ZONES.map((k) => byKey.get(k) ?? { key: k, meta: ZONE_META[k], projects: [] });
  const total = ordered.reduce((n, z) => n + z.projects.length, 0);
  const sections = ordered.map(renderZone).join('\n\n');
  const stamp = generatedAt ? esc(generatedAt) : '';

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lucy · Cổng dự án</title>
<style>
  :root{
    --bg:#070a10; --panel:#0f1622; --panel2:#0b111b; --line:#1b2636;
    --txt:#e3eaf5; --mut:#8298b6; --gold:#e8c474; --gold2:#f4dca0;
    --cyan:#5fd3e0; --green:#5fd38a; --violet:#a98bff; --rose:#ff8fb0;
  }
  *{box-sizing:border-box}
  body{margin:0;background:
      radial-gradient(900px 500px at 80% -10%,rgba(95,211,224,.08),transparent),
      radial-gradient(700px 500px at 0% 110%,rgba(169,139,255,.07),transparent),
      var(--bg);
    color:var(--txt);min-height:100vh;
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    -webkit-font-smoothing:antialiased}
  a{text-decoration:none;color:inherit}
  .wrap{max-width:1000px;margin:0 auto;padding:34px 22px 80px}

  .banner{font-size:11.5px;letter-spacing:.5px;color:#0a0d14;background:var(--gold);
    display:inline-block;padding:3px 12px;border-radius:20px;font-weight:700;margin-bottom:20px}

  header{display:flex;align-items:center;gap:16px;margin-bottom:6px}
  .orb{width:52px;height:52px;border-radius:50%;flex:none;
    background:radial-gradient(circle at 35% 30%,var(--gold2),var(--gold) 45%,#7a5a1e 100%);
    box-shadow:0 0 24px rgba(232,196,116,.45),inset 0 0 12px rgba(255,255,255,.3)}
  h1{font-size:27px;margin:0;letter-spacing:.3px}
  h1 .accent{color:var(--gold)}
  .tag{color:var(--mut);font-size:13.5px;margin-top:2px}

  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:30px}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}

  .zone{background:linear-gradient(160deg,var(--panel),var(--panel2));
    border:1px solid var(--line);border-radius:16px;padding:20px 22px;position:relative;
    transition:.18s;overflow:hidden}
  .zone:hover{border-color:rgba(232,196,116,.4);transform:translateY(-2px)}
  .zone::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;
    background:var(--accent,var(--gold))}
  .zhead{display:flex;align-items:center;gap:11px;margin-bottom:4px}
  .zico{font-size:22px}
  .zttl{font-size:17px;font-weight:700}
  .zpath{font-size:12px;color:var(--mut);font-family:"SF Mono",Menlo,monospace;
    background:var(--panel2);border:1px solid var(--line);padding:1px 7px;border-radius:5px}
  .zdesc{color:var(--mut);font-size:13px;margin:8px 0 14px}

  .items{display:flex;flex-direction:column;gap:7px}
  .item{display:block;
    padding:8px 11px;border-radius:9px;background:rgba(255,255,255,.018);
    border:1px solid transparent;transition:.15s;cursor:pointer}
  .item:hover{background:rgba(95,211,224,.07);border-color:var(--line)}
  .irow{display:flex;align-items:center;gap:9px;font-size:13.5px}
  .dot{width:7px;height:7px;border-radius:50%;flex:none}
  .live{background:var(--green);box-shadow:0 0 7px var(--green)}
  .static{background:var(--cyan)}
  .idea{background:var(--gold)}
  .ittl{font-weight:600}
  .arrow{margin-left:auto;color:var(--mut);font-size:12px;white-space:nowrap}
  .idesc{color:var(--mut);font-size:12px;margin:3px 0 0 16px}
  .tags{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 0 16px}
  .tag-chip{font-size:10.5px;color:var(--mut);background:var(--panel2);
    border:1px solid var(--line);padding:1px 7px;border-radius:10px}
  .more{font-size:12px;color:var(--mut);padding:4px 10px}

  footer{margin-top:40px;text-align:center;color:var(--mut);font-size:12.5px;
    border-top:1px solid var(--line);padding-top:18px}
</style>
</head>
<body>
<div class="wrap">
  <div class="banner">CỔNG TĨNH · ${total} dự án · độc lập hub chính</div>

  <header>
    <div class="orb"></div>
    <div>
      <h1><span class="accent">Lucy</span> · Cổng dự án</h1>
      <div class="tag">Một cửa vào — gom hết link, tách khỏi hub chính · <code>14.225.255.73/lucy/</code></div>
    </div>
  </header>

  <div class="grid">

${sections}

  </div>

  <footer>Lucy · cổng tĩnh độc lập hub chính · nhẹ VPS${stamp ? ` · cập nhật ${stamp}` : ''}</footer>
</div>
</body>
</html>
`;
}

export default { renderPage };
