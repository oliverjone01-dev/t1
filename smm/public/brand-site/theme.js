/* Общий тумблер темы для всех страниц бренд-сайта. Начальная тема ставится
   inline-скриптом в <head> (без мигания); здесь только проводка кнопок .tt.
   Ключ localStorage единый: gg.theme - тема держится при переходах между страницами. */
(function () {
  'use strict';
  var R = document.documentElement;
  function sync() {
    var t = R.getAttribute('data-theme') || 'light';
    Array.prototype.forEach.call(document.querySelectorAll('.tt button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-t') === t);
    });
  }
  function set(t) { R.setAttribute('data-theme', t); try { localStorage.setItem('gg.theme', t); } catch (e) { } sync(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.tt button');
    if (b) set(b.getAttribute('data-t'));
  });
  sync();
  window.GG_setTheme = set;
})();
