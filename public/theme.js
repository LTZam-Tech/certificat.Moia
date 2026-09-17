'use strict';

/**
 * Applied as early as possible (synchronously, before first paint) on every
 * page so a saved preference never flashes the wrong theme. Two independent
 * settings, combinable: dark mode and a color-blind-safe palette (swaps the
 * red/green danger-vs-success pairing, the classic confusable pair for
 * red-green color blindness, for an amber/green pairing instead).
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

applyTheme();
