/* Lucy Reports — tiny SVG chart lib (no deps).
 * Dùng: LucyChart.spark(el, points, opts) | LucyChart.renderAll()
 * points: [{date:'YYYY-MM-DD', v:Number}]  (>=2 điểm mới vẽ)
 * Dữ liệu nhúng sẵn ở window.LUCY_SERIES (mảng metric từ buildSeriesArrays).
 */
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const UP = '#2ecc71', DOWN = '#ff5a5a', FLAT = '#93a1b5';

  function el(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

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

  /** Vẽ line chart (sparkline) vào container `host`. */
  function spark(host, points, opts) {
    opts = opts || {};
    host.innerHTML = '';
    if (!points || points.length < 2) {
      host.innerHTML = '<div class="chart-empty">chưa đủ dữ liệu (cần ≥2 ngày)</div>';
      return;
    }
    const W = opts.w || host.clientWidth || 280;
    const H = opts.h || 70;
    const P = opts.pad == null ? 6 : opts.pad;
    const vals = points.map((p) => p.v);
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
    const n = points.length;
    const X = (i) => P + (i / (n - 1)) * (W - 2 * P);
    const Y = (v) => H - P - ((v - min) / range) * (H - 2 * P);
    const rising = vals[n - 1] >= vals[0];
    const color = opts.color || (rising ? UP : DOWN);
    const uid = 'lg' + (opts.id || Math.abs(hashStr(host.id + n + vals[0])));

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, preserveAspectRatio: 'none', class: 'spark-svg' });

    // gradient fill
    const defs = el('defs', {});
    const grad = el('linearGradient', { id: uid, x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.28' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    let dLine = '';
    points.forEach((p, i) => { dLine += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1) + ' '; });
    const dArea = dLine + `L${X(n - 1).toFixed(1)} ${H - P} L${X(0).toFixed(1)} ${H - P} Z`;

    svg.appendChild(el('path', { d: dArea, fill: `url(#${uid})`, stroke: 'none' }));
    svg.appendChild(el('path', { d: dLine, fill: 'none', stroke: color, 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    // điểm cuối nhấn mạnh
    svg.appendChild(el('circle', { cx: X(n - 1).toFixed(1), cy: Y(vals[n - 1]).toFixed(1), r: '3', fill: color }));

    host.appendChild(svg);

    // ---- hover tooltip ----
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.style.display = 'none';
    host.appendChild(tip);
    const dot = el('circle', { r: '3.5', fill: '#fff', stroke: color, 'stroke-width': '2', style: 'display:none' });
    svg.appendChild(dot);

    const fmt = opts.fmt || 'num';
    function move(ev) {
      const rect = svg.getBoundingClientRect();
      const clientX = (ev.touches ? ev.touches[0].clientX : ev.clientX);
      const rel = (clientX - rect.left) / rect.width;
      let idx = Math.round(rel * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      const p = points[idx];
      // toạ độ theo viewBox -> px thực
      const px = (X(idx) / W) * rect.width;
      dot.setAttribute('cx', X(idx).toFixed(1));
      dot.setAttribute('cy', Y(p.v).toFixed(1));
      dot.style.display = '';
      tip.style.display = 'block';
      tip.innerHTML = `<b>${fmtVal(p.v, fmt)}</b><span>${p.date.slice(5)}</span>`;
      const tw = tip.offsetWidth || 60;
      tip.style.left = Math.max(0, Math.min(rect.width - tw, px - tw / 2)) + 'px';
    }
    function leave() { tip.style.display = 'none'; dot.style.display = 'none'; }
    svg.addEventListener('mousemove', move);
    svg.addEventListener('mouseleave', leave);
    svg.addEventListener('touchstart', move, { passive: true });
    svg.addEventListener('touchmove', move, { passive: true });
    svg.addEventListener('touchend', leave);
  }

  function hashStr(s) {
    let h = 0; s = String(s);
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return h;
  }

  /** Render mọi .lucy-spark[data-key] từ window.LUCY_SERIES. */
  function renderAll() {
    const series = window.LUCY_SERIES || [];
    const byKey = {};
    series.forEach((m) => { byKey[m.key] = m; });
    document.querySelectorAll('.lucy-spark[data-key]').forEach((host) => {
      const m = byKey[host.getAttribute('data-key')];
      if (!m) { host.innerHTML = '<div class="chart-empty">—</div>'; return; }
      spark(host, m.points, { color: m.meta && m.meta.color, fmt: m.meta && m.meta.fmt });
    });
  }

  window.LucyChart = { spark, renderAll, fmtVal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }
  // vẽ lại khi xoay/resize (debounce)
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderAll, 200); });
})();
