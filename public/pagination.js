'use strict';

/**
 * Minimal client-side pager shared by the employee and admin screens.
 * Slices an in-memory array into pages and renders Prev/Next controls;
 * callers only supply how to render one page's worth of items.
 */
function createPaginator({ containerId, pageSize, renderPage, pageLabel }) {
  let items = [];
  let page = 1;

  function setItems(newItems) {
    items = newItems || [];
    page = 1;
    render();
  }

  function render() {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    renderPage(items.slice(start, start + pageSize));
    renderControls(totalPages);
  }

  function renderControls(totalPages) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (items.length <= pageSize) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    const label = pageLabel ? pageLabel(page, totalPages) : `${page} / ${totalPages}`;
    container.innerHTML = `
      <button type="button" class="page-btn" data-dir="prev" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
      <span class="page-info" dir="ltr">${label}</span>
      <button type="button" class="page-btn" data-dir="next" ${page === totalPages ? 'disabled' : ''} aria-label="Next page">›</button>
    `;
    container.querySelector('[data-dir="prev"]').addEventListener('click', () => { page--; render(); });
    container.querySelector('[data-dir="next"]').addEventListener('click', () => { page++; render(); });
  }

  return { setItems, render };
}
