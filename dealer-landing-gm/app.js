(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const menu = $('#mobile-menu'), toggle = $('.menu-toggle'), viewer = $('#photo-viewer');
  const form = $('#request-form'), result = $('#request-result');
  const contact = $('[name="contact"]', form), consent = $('[name="consent"]', form), subject = $('[name="subject"]', form);
  let requestText = '', photoTrigger = null;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function syncDialogs() {
    document.body.classList.toggle('dialog-open', menu.open || viewer.open);
    document.body.classList.toggle('menu-open', menu.open);
    toggle.setAttribute('aria-expanded', String(menu.open));
  }
  function closeMenu() { if (menu.open) menu.close(); }
  toggle.addEventListener('click', () => { menu.showModal(); syncDialogs(); });
  $('#close-menu').addEventListener('click', closeMenu);
  menu.addEventListener('close', syncDialogs);
  menu.addEventListener('click', e => {
    if (e.target.closest('a[href^="#"]')) closeMenu();
    const r = menu.getBoundingClientRect();
    if (e.target === menu && (e.clientX < r.left || e.clientX > r.right)) closeMenu();
  });
  function editRequest(newSubject) {
    if (newSubject) subject.value = newSubject;
    form.hidden = false; result.hidden = true; requestText = '';
    $('#request-summary').textContent = ''; $('#request-status').textContent = '';
  }
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-subject]');
    if (action) { editRequest(action.dataset.subject); closeMenu(); if (viewer.open) viewer.close(); }
    const photo = e.target.closest('[data-photo-src]');
    if (photo) {
      photoTrigger = photo;
      $('#photo-image').src = photo.dataset.photoSrc;
      $('#photo-image').alt = photo.dataset.photoTitle;
      $('#photo-caption').textContent = photo.dataset.photoTitle;
      $('#photo-select').dataset.subject = photo.dataset.photoSubject;
      viewer.showModal(); syncDialogs();
    }
  });
  $('#close-photo').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => { syncDialogs(); if (photoTrigger?.isConnected) photoTrigger.focus({ preventScroll: true }); });
  viewer.addEventListener('click', e => {
    const r = viewer.getBoundingClientRect();
    if (e.target === viewer && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) viewer.close();
  });
  for (const viewport of document.querySelectorAll('[data-carousel]')) {
    const cards = [...viewport.querySelectorAll('[data-gallery-card]')];
    const controls = [...document.querySelectorAll('[data-gallery-target]')].filter(b => b.dataset.galleryTarget === viewport.id);
    const status = $(`[data-gallery-status="${viewport.dataset.carousel}"]`);
    function updateGallery() {
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      for (const b of controls) b.disabled = Number(b.dataset.slide) < 0 ? viewport.scrollLeft <= 2 : viewport.scrollLeft >= max - 2;
      const r = viewport.getBoundingClientRect();
      const visible = cards.map((c, i) => ({ r: c.getBoundingClientRect(), i })).filter(c => c.r.right > r.left + 24 && c.r.left < r.right - 24);
      if (status && visible.length) {
        const first = visible[0].i + 1, last = visible.at(-1).i + 1;
        status.textContent = `${first === last ? first : `${first}–${last}`} из ${cards.length}`;
      }
    }
    function move(direction) {
      if (!cards[0]) return;
      const gap = Number.parseFloat(getComputedStyle(cards[0].parentElement).columnGap) || 24;
      viewport.scrollBy({ left: direction * (cards[0].getBoundingClientRect().width + gap), behavior: reducedMotion() ? 'instant' : 'smooth' });
    }
    for (const b of controls) b.addEventListener('click', () => move(Number(b.dataset.slide)));
    viewport.addEventListener('keydown', e => {
      if (e.target !== viewport) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); viewport.scrollTo({ left: e.key === 'Home' ? 0 : viewport.scrollWidth, behavior: 'instant' }); }
    });
    viewport.addEventListener('scroll', updateGallery, { passive: true });
    new ResizeObserver(updateGallery).observe(viewport); updateGallery();
  }
  function validContact(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || (value.replace(/\D/g, '').length >= 7 && /^[+\d\s().-]+$/.test(value)); }
  function setError(field, selector, invalid) { $(selector).hidden = !invalid; field.setAttribute('aria-invalid', String(invalid)); }
  contact.addEventListener('input', () => { if (validContact(contact.value.trim())) setError(contact, '#contact-error', false); });
  consent.addEventListener('change', () => { if (consent.checked) setError(consent, '#consent-error', false); });
  form.addEventListener('submit', e => {
    e.preventDefault(); const valid = validContact(contact.value.trim());
    setError(contact, '#contact-error', !valid); setError(consent, '#consent-error', !consent.checked);
    if (!valid || !consent.checked) { (valid ? consent : contact).focus(); return; }
    const data = new FormData(form);
    requestText = `Запрос GLASS-MEMORY\n\nИзделие: ${data.get('subject').trim() || 'Пока выбираю'}\nИмя: ${data.get('name').trim() || 'Не указано'}\nКонтакт: ${data.get('contact').trim()}\n\nДемонстрационная форма. Запрос не отправлен.`;
    $('#request-summary').textContent = requestText; form.hidden = true; result.hidden = false;
    $('#request-status').textContent = 'Запрос подготовлен. Данные не отправлены.'; result.focus({ preventScroll: true });
  });
  $('#edit-request').addEventListener('click', () => { editRequest(); contact.focus({ preventScroll: true }); });
  $('#download-request').addEventListener('click', () => {
    if (!requestText) return;
    const url = URL.createObjectURL(new Blob([requestText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'glass-memory-request.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
