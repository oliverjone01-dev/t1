(() => {
  document.documentElement.classList.add('js');
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const progress = document.querySelector('.reading-progress span');
  const menuButton = document.querySelector('.menu-button');
  const mobileNav = document.querySelector('.mobile-nav');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;
  let lastFocus = null;

  const updateChrome = () => {
    header?.classList.toggle('scrolled', scrollY > 10);
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.width = `${max > 0 ? Math.min(100, scrollY / max * 100) : 0}%`;
    }
  };
  addEventListener('scroll', updateChrome, { passive: true });
  updateChrome();

  if (!reduced && matchMedia('(pointer:fine)').matches) {
    addEventListener('pointermove', event => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--mx', `${event.clientX / innerWidth * 100}%`);
        root.style.setProperty('--my', `${event.clientY / innerHeight * 100}%`);
        frame = 0;
      });
    }, { passive: true });
  }

  const closeMenu = (restore = false) => {
    menuButton?.setAttribute('aria-expanded', 'false');
    mobileNav?.classList.remove('open');
    document.body.classList.remove('menu-open');
    if (restore && lastFocus instanceof HTMLElement) lastFocus.focus();
  };
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    if (!open) lastFocus = document.activeElement;
    menuButton.setAttribute('aria-expanded', String(!open));
    mobileNav?.classList.toggle('open', !open);
    document.body.classList.toggle('menu-open', !open);
    if (!open) mobileNav?.querySelector('a')?.focus();
  });
  mobileNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu(false)));
  addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') closeMenu(true);
    if (event.key === 'Tab' && menuButton?.getAttribute('aria-expanded') === 'true' && mobileNav) {
      const focusable = [...mobileNav.querySelectorAll('a')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  addEventListener('resize', () => { if (innerWidth > 1160) closeMenu(); }, { passive: true });

  const jm=document.querySelector('.journey-more');
  jm?.addEventListener('click',()=>{jm.closest('.journey-map')?.classList.add('expanded');});

  const page = document.body.dataset.page;
  document.querySelectorAll(`[data-page-link="${page}"]`).forEach(link => link.setAttribute('aria-current', 'page'));

  const reveals = [...document.querySelectorAll('.reveal')];
  if (reduced) reveals.forEach(item => item.classList.add('in'));
  else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10%' });
    reveals.forEach(item => observer.observe(item));
  }

  const leadRange = document.querySelector('#monthly-leads');
  const leadValue = document.querySelector('#monthly-leads-value');
  const leadPrice = document.querySelector('#lead-price');
  const lossResult = document.querySelector('#loss-result');
  const recalc = () => {
    if (!leadRange || !leadPrice || !lossResult) return;
    const leads = Number(leadRange.value);
    const price = Math.max(0, Number(leadPrice.value) || 0);
    if (leadValue) leadValue.textContent = `${leads}`;
    const low = Math.round(leads * .1 * price);
    const high = Math.round(leads * .25 * price);
    lossResult.textContent = `${low.toLocaleString('ru-RU')}-${high.toLocaleString('ru-RU')} ₽`;
  };
  leadRange?.addEventListener('input', recalc);
  leadPrice?.addEventListener('input', recalc);
  recalc();

  const audit = document.querySelector('[data-audit]');
  if (audit) {
    const questions = [...audit.querySelectorAll('.question')];
    const steps = [...document.querySelectorAll('.audit-step')];
    const back = audit.querySelector('[data-back]');
    const next = audit.querySelector('[data-next]');
    const result = audit.querySelector('.audit-result');
    const scoreNode = audit.querySelector('.audit-result [data-score]');
    const resultTitle = audit.querySelector('[data-result-title]');
    const resultCopy = audit.querySelector('[data-result-copy]');
    let current = 0;
    const answers = {};

    const show = index => {
      current = index;
      questions.forEach((question, i) => question.classList.toggle('active', i === current));
      steps.forEach((step, i) => step.classList.toggle('active', i === current));
      if (back) back.style.visibility = current === 0 ? 'hidden' : 'visible';
      if (next) next.textContent = current === questions.length - 1 ? 'Показать результат' : 'Следующий вопрос';
    };
    audit.addEventListener('click', event => {
      const option = event.target instanceof Element ? event.target.closest('.option') : null;
      if (!option || !audit.contains(option)) return;
      const question = option.closest('.question');
      question?.querySelectorAll('.option').forEach(item => item.classList.remove('selected'));
      option.classList.add('selected');
      answers[question?.dataset.key || 'unknown'] = Number(option.dataset.score || 0);
    });
    back?.addEventListener('click', () => { if (current > 0) show(current - 1); });
    next?.addEventListener('click', () => {
      const question = questions[current];
      if (!question?.querySelector('.option.selected')) {
        question?.querySelector('.options')?.setAttribute('aria-label', 'Выберите один вариант, чтобы продолжить');
        question?.querySelector('.option')?.focus();
        return;
      }
      if (current < questions.length - 1) show(current + 1);
      else {
        const total = Object.values(answers).reduce((sum, value) => sum + value, 0);
        const score = Math.min(100, Math.round(total / (questions.length * 4) * 100));
        questions.forEach(questionItem => questionItem.classList.remove('active'));
        document.querySelector('.audit-controls')?.setAttribute('hidden', '');
        result?.classList.add('active');
        if (scoreNode) scoreNode.textContent = String(score);
        if (score < 40) {
          if (resultTitle) resultTitle.textContent = 'Начните с одной связки';
          if (resultCopy) resultCopy.textContent = 'Сложная система вам пока не нужна. Сначала соберите один понятный путь заявки и проверьте его коротким пробным запуском.';
        } else if (score < 70) {
          if (resultTitle) resultTitle.textContent = 'Сначала найдите утечку';
          if (resultCopy) resultCopy.textContent = 'Реклама уже работает, но между заявкой и продажей теряется порядок. Начните с диагностики и одного экрана Пульс.';
        } else {
          if (resultTitle) resultTitle.textContent = 'Система готова к точечному росту';
          if (resultCopy) resultCopy.textContent = 'Базовый порядок уже есть. Не перестраивайте всё: усильте один канал, который доказал результат, и добавьте видимость в поиске (GEO).';
        }
        steps.forEach(step => step.classList.remove('active'));
      }
    });
    show(0);
  }
})();
