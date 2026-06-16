/* Lucy Reports — REPORT page interactions. */
(function () {
  // ---- theme (persist) ----
  try {
    if (localStorage.getItem('lucy-theme') === 'light') document.documentElement.classList.add('light');
  } catch (e) {}
  function toggleTheme() {
    const light = document.documentElement.classList.toggle('light');
    try { localStorage.setItem('lucy-theme', light ? 'light' : 'dark'); } catch (e) {}
  }

  function onReady() {
    const header = document.querySelector('.header.sticky');
    const bar = document.querySelector('.progress-bar');
    const toTop = document.querySelector('.to-top');

    // reading progress + sticky shrink + scroll-top visibility
    function onScroll() {
      const st = window.scrollY || document.documentElement.scrollTop;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.width = (docH > 0 ? (st / docH) * 100 : 0) + '%';
      if (header) header.classList.toggle('shrink', st > 120);
      if (toTop) toTop.classList.toggle('show', st > 320);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    const themeBtn = document.querySelector('[data-action="theme"]');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // collapsible sections
    document.querySelectorAll('.section[data-collapsible] .section-header').forEach((h) => {
      h.addEventListener('click', () => h.closest('.section').classList.toggle('collapsed'));
    });

    // fade-in on view
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.08 });
      document.querySelectorAll('.section, .summary-box').forEach((s) => { s.classList.add('reveal'); io.observe(s); });
    }

    buildPrevNext();
  }

  // ---- prev/next nav từ manifest.json ----
  function buildPrevNext() {
    const nav = document.querySelector('.report-nav');
    if (!nav) return;
    const type = nav.getAttribute('data-type') || 'market';
    const cur = location.pathname.split('/').pop();
    fetch('../data/manifest.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((mf) => {
        const list = (mf[type] || []).map((x) => (typeof x === 'string' ? x : x.file));
        const i = list.indexOf(cur);
        if (i < 0) return;
        // list mới->cũ: newer = i-1, older = i+1
        const prevEl = nav.querySelector('[data-slot="prev"]');
        const nextEl = nav.querySelector('[data-slot="next"]');
        if (prevEl) setNav(prevEl, list[i - 1], 'Mới hơn ›');
        if (nextEl) setNav(nextEl, list[i + 1], '‹ Cũ hơn');
      })
      .catch(() => {});
  }
  function setNav(el, file, label) {
    if (!file) { el.classList.add('disabled'); return; }
    el.setAttribute('href', file);
    const lbl = el.querySelector('.nav-label');
    if (lbl) lbl.textContent = file.replace(/^(brief|tech)-/, '').replace(/\.html$/, '');
    const dir = el.querySelector('.nav-dir');
    if (dir) dir.textContent = label;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
})();
