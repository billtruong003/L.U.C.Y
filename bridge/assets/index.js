/* Lucy Reports — INDEX (archive) interactions: tabs, search, theme. */
(function () {
  try {
    if (localStorage.getItem('lucy-theme') === 'light') document.documentElement.classList.add('light');
  } catch (e) {}

  function onReady() {
    // theme toggle
    const themeBtn = document.querySelector('[data-action="theme"]');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      const light = document.documentElement.classList.toggle('light');
      try { localStorage.setItem('lucy-theme', light ? 'light' : 'dark'); } catch (e) {}
      if (window.LucyChart) window.LucyChart.renderAll();
    });

    // tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById('tab-' + key);
        if (panel) panel.classList.add('active');
        if (history.replaceState) history.replaceState(null, '', '#' + key);
        runSearch();
      });
    });
    const h = (location.hash || '').replace('#', '');
    if (h) { const b = document.querySelector('.tab-btn[data-tab="' + h + '"]'); if (b) b.click(); }

    // search filter (chỉ trong panel đang active)
    const input = document.getElementById('search');
    if (input) input.addEventListener('input', runSearch);
    function runSearch() {
      const q = (input ? input.value : '').trim().toLowerCase();
      document.querySelectorAll('.tab-panel.active').forEach((panel) => {
        let shown = 0;
        panel.querySelectorAll('.report-card').forEach((card) => {
          const hay = card.getAttribute('data-search') || card.textContent;
          const match = !q || hay.toLowerCase().indexOf(q) !== -1;
          card.style.display = match ? '' : 'none';
          if (match) shown++;
        });
        const nr = panel.querySelector('.no-results');
        if (nr) nr.style.display = shown === 0 ? 'block' : 'none';
        const lbl = panel.querySelector('.section-label');
        if (lbl && q) lbl.style.display = shown === 0 ? 'none' : '';
      });
    }
    window.__lucyRunSearch = runSearch;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
})();
