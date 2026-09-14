/* GENGROUP Brand Glossary — interactive layer
   Modules: sidebar active state + accordion, mobile drawer,
            scroll progress bar, in-page TOC observer, search.
   No external dependencies. */

(function () {
  'use strict';

  const MOBILE_BREAKPOINT = 1024;

  /* -------- helpers -------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function isMobile() { return window.matchMedia('(max-width: ' + (MOBILE_BREAKPOINT - 1) + 'px)').matches; }

  /* -------- sidebar: active link + accordion sublist -------- */
  function initSidebar() {
    const current = document.body.getAttribute('data-current') || '';
    if (!current) return;

    const activeLink = $('.sidebar__link[data-section="' + current + '"]');
    if (!activeLink) return;
    activeLink.classList.add('is-active');

    // collect h2[id] from main content and inject sublist after the active link
    const headings = $$('.main h2[id]');
    if (!headings.length) return;

    const sublist = document.createElement('ul');
    sublist.className = 'sidebar__sublist is-open';

    headings.forEach(function (h) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'sidebar__sublink';
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.setAttribute('data-target', h.id);
      li.appendChild(a);
      sublist.appendChild(li);
    });

    activeLink.parentNode.appendChild(sublist);
  }

  /* -------- mobile drawer -------- */
  function initDrawer() {
    const sidebar = $('#sidebar');
    const overlay = $('#overlay');
    const hamburger = $('#hamburger');
    const closeBtn = $('#sidebar-close');
    if (!sidebar || !overlay || !hamburger) return;

    function open() {
      sidebar.classList.add('is-open');
      overlay.classList.add('is-open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      sidebar.classList.remove('is-open');
      overlay.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', function () {
      sidebar.classList.contains('is-open') ? close() : open();
    });
    overlay.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);

    // close on link click inside sidebar (mobile only)
    sidebar.addEventListener('click', function (e) {
      const link = e.target.closest('a');
      if (link && isMobile()) {
        close();
      }
    });

    // close on Esc
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) close();
    });
  }

  /* -------- scroll progress bar in sidebar -------- */
  function initProgressBar() {
    const bar = $('#progress-bar');
    if (!bar) return;
    function update() {
      const h = document.documentElement;
      const scrolled = h.scrollTop || document.body.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? Math.min(100, (scrolled / max) * 100) : 0;
      bar.style.width = pct + '%';
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* -------- in-page TOC observer (for sidebar sublinks) -------- */
  function initSectionObserver() {
    const sublinks = $$('.sidebar__sublink');
    if (!sublinks.length) return;
    const map = new Map();
    sublinks.forEach(function (a) {
      const id = a.getAttribute('data-target');
      const target = id ? document.getElementById(id) : null;
      if (target) map.set(target, a);
    });
    if (!map.size) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const link = map.get(entry.target);
        if (!link) return;
        if (entry.isIntersecting) {
          sublinks.forEach(function (l) { l.classList.remove('is-active'); });
          link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    map.forEach(function (_link, target) { observer.observe(target); });
  }

  /* -------- highlight ?q=term in URL on the page -------- */
  function highlightQuery() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (!q) return;
    const main = $('.main .content');
    if (!main) return;
    highlightTextInNode(main, q.toLowerCase());
  }

  function highlightTextInNode(node, needle) {
    if (!needle) return;
    const skipTags = { SCRIPT: 1, STYLE: 1, MARK: 1, INPUT: 1, TEXTAREA: 1, NAV: 1 };
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.parentNode || skipTags[n.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
        if (n.parentNode.closest && n.parentNode.closest('.crumbs, .sidebar, .alpha-grid, .pager')) {
          return NodeFilter.FILTER_REJECT;
        }
        return n.nodeValue && n.nodeValue.toLowerCase().indexOf(needle) !== -1
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });
    const targets = [];
    let cur;
    while ((cur = walker.nextNode())) targets.push(cur);

    let firstMark = null;
    targets.forEach(function (textNode) {
      const text = textNode.nodeValue;
      const lower = text.toLowerCase();
      let idx = 0;
      let last = 0;
      const frag = document.createDocumentFragment();
      while ((idx = lower.indexOf(needle, last)) !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement('mark');
        mark.textContent = text.slice(idx, idx + needle.length);
        frag.appendChild(mark);
        if (!firstMark) firstMark = mark;
        last = idx + needle.length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });

    if (firstMark) {
      setTimeout(function () { firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
    }
  }

  /* -------- bootstrap -------- */
  document.addEventListener('DOMContentLoaded', function () {
    initSidebar();
    initDrawer();
    initProgressBar();
    initSectionObserver();
    highlightQuery();
  });
})();
