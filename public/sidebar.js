'use strict';

/**
 * Wires up the #sidebarToggle handle (see style.css's ".sidebar-toggle" /
 * ".sidebar-expanded" rules and theme.js's applySidebarState for the
 * synchronous default). Call after the sidebar markup exists in the DOM.
 */
function initSidebarToggle() {
  const btn = document.getElementById('sidebarToggle');
  if (!btn) return;

  function isExpanded() {
    return document.documentElement.classList.contains('sidebar-expanded');
  }

  function sync() {
    const expanded = isExpanded();
    const lang = typeof getLang === 'function' ? getLang() : (document.documentElement.lang || 'en');
    btn.setAttribute('aria-expanded', String(expanded));
    const label = expanded
      ? (lang === 'ar' ? 'طي القائمة الجانبية' : 'Collapse menu')
      : (lang === 'ar' ? 'توسيع القائمة الجانبية' : 'Expand menu');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  btn.addEventListener('click', () => {
    setSidebarExpanded(!isExpanded());
    sync();
  });

  sync();
  window.sidebarToggleSync = sync;
}
