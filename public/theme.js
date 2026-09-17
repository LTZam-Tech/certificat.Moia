'use strict';

/**
 * Applied as early as possible (synchronously, before first paint) on every
 * page so a saved preference never flashes the wrong theme. Two independent
 * settings, combinable: dark mode and a color-blind-safe palette that remaps
 * the success/warning/danger/info tokens to hues modeled on the Okabe-Ito
 * colorblind-safe qualitative palette (see the token definitions and
 * component-level icon/border rules in style.css for the full picture).
 */
function getTheme() {
  return localStorage.getItem('portal_theme') || 'light';
}
function setTheme(theme) {
  localStorage.setItem('portal_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}
function getColorblind() {
  return localStorage.getItem('portal_colorblind') === 'true';
}
function setColorblind(on) {
  localStorage.setItem('portal_colorblind', on ? 'true' : 'false');
  document.documentElement.toggleAttribute('data-colorblind', on);
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', getTheme());
  document.documentElement.toggleAttribute('data-colorblind', getColorblind());
}

/**
 * The collapsible sidebar's open/closed state, applied synchronously here
 * (same reasoning as the theme above: avoid a flash of the wrong layout).
 * Unset means "follow the viewport" -- expanded on desktop, collapsed
 * below it -- matching the sidebar's old pure-CSS-breakpoint behavior.
 * Once the user clicks the handle, their explicit choice is persisted and
 * wins at every width until they toggle it again.
 */
function getSidebarExpanded() {
  const stored = localStorage.getItem('portal_sidebar');
  if (stored === 'expanded') return true;
  if (stored === 'collapsed') return false;
  return window.matchMedia('(min-width: 1200px)').matches;
}
function setSidebarExpanded(expanded) {
  localStorage.setItem('portal_sidebar', expanded ? 'expanded' : 'collapsed');
  document.documentElement.classList.toggle('sidebar-expanded', expanded);
}
function applySidebarState() {
  document.documentElement.classList.toggle('sidebar-expanded', getSidebarExpanded());
}

applyTheme();
applySidebarState();
