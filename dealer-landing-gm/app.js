const $ = (selector, root = document) => root.querySelector(selector);
const menu = $('#mobile-menu');
const menuToggle = $('.menu-toggle');
function closeMenu() {
  menu.close();
  document.body.classList.remove('menu-open');
  menuToggle.setAttribute('aria-expanded', 'false');
}
menuToggle.addEventListener('click', () => {
  menu.showModal();
  document.body.classList.add('menu-open');
  menuToggle.setAttribute('aria-expanded', 'true');
});
$('#close-menu').addEventListener('click', closeMenu);
menu.addEventListener('cancel', () => {
  document.body.classList.remove('menu-open');
  menuToggle.setAttribute('aria-expanded', 'false');
});
menu.addEventListener('click', event => {
  if (event.target.closest('a[href^="#"]')) closeMenu();
  if (event.target === menu && event.clientX < menu.getBoundingClientRect().left) closeMenu();
});
document.addEventListener('click', event => {
  const link = event.target.closest('[data-subject]');
  if (link) $('#request-form [name="subject"]').value = link.dataset.subject;
  const arrow = event.target.closest('[data-slide]');
  if (arrow) {
    const carousel = $('[data-carousel]', arrow.closest('section'));
    const card = $('[data-gallery-card]', carousel);
    carousel.scrollBy({ left: Number(arrow.dataset.slide) * (card.getBoundingClientRect().width + 24), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
});
const form = $('#request-form');
const contact = $('[name="contact"]', form);
const consent = $('[name="consent"]', form);
let requestText = '';
function validContact(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || (value.replace(/\D/g, '').length >= 7 && /^[+\d\s().-]+$/.test(value));
}
form.addEventListener('submit', event => {
  event.preventDefault();
  const contactValid = validContact(contact.value.trim());
  $('#contact-error').hidden = contactValid;
  contact.setAttribute('aria-invalid', String(!contactValid));
  $('#consent-error').hidden = consent.checked;
  consent.setAttribute('aria-invalid', String(!consent.checked));
  if (!contactValid || !consent.checked) {
    (contactValid ? consent : contact).focus();
    return;
  }
  const data = new FormData(form);
  requestText = `Запрос GLASS-MEMORY\n\nИзделие: ${data.get('subject').trim() || 'Пока выбираю'}\nИмя: ${data.get('name').trim() || 'Не указано'}\nКонтакт: ${data.get('contact').trim()}\n\nДемонстрационная форма. Запрос не отправлен.`;
  $('#request-summary').textContent = requestText;
  form.hidden = true;
  $('#request-result').hidden = false;
  $('#request-result').focus({ preventScroll: true });
});
$('#edit-request').addEventListener('click', () => {
  $('#request-result').hidden = true;
  form.hidden = false;
  contact.focus({ preventScroll: true });
});
$('#download-request').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([requestText], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'glass-memory-request.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
