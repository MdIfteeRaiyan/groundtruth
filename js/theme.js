/* Applies the saved or system theme before first paint (no flash). */
(function () {
  var t = 'light';
  try { t = localStorage.getItem('groundtruth.theme') || 'light'; } catch (e) { /* default */ }
  document.documentElement.setAttribute('data-theme', t);
})();
