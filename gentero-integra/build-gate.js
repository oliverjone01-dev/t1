#!/usr/bin/env node
/**
 * Шифрование документа ИНТЕГРА 2.0 под парольный вход.
 *
 * Зачем шифровать, а не сверять пароль в коде. Страница лежит на публичном
 * GitHub Pages из публичного репозитория. Проверка вида `if (pass === "...")`
 * не защищает ничего: текст остаётся в исходнике, его видно через «просмотр кода
 * страницы» и прямо в репозитории. Поэтому тело документа шифруется, и в
 * опубликованный файл попадает только шифротекст.
 *
 *   AES-GCM 256, ключ из пароля через PBKDF2-SHA256, 250 000 итераций.
 *   Нагрузка: base64(salt[16] || iv[12] || ciphertext+tag).
 *   Расшифровка в браузере через WebCrypto: работает офлайн и с file://.
 *
 * Node crypto и WebCrypto здесь совместимы побайтово: WebCrypto ждёт тег
 * аутентификации в хвосте шифротекста, поэтому дописываем getAuthTag() вручную.
 *
 * Использование:
 *   node build-gate.js lock   <plain.html> <out.html> <пароль>
 *   node build-gate.js unlock <gated.html> <out.html> <пароль>
 *
 * Цикл правки: unlock -> редактируешь -> lock. Открытый текст не коммитится.
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const ITER = 250000;
const derive = (pass, salt) => crypto.pbkdf2Sync(pass, salt, ITER, 32, 'sha256');

const GATE = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<meta name="referrer" content="no-referrer">
<title>GEN-GROUP</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23060807'/%3E%3Cpath d='M4 18V6l8 8 8-8v12' fill='none' stroke='%23c7ff39' stroke-width='2'/%3E%3C/svg%3E">
__STYLE__
<style>
/* ---------- парольный вход ---------- */
#gate{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:24px;
  background:radial-gradient(ellipse at 50% 0%,rgba(199,255,57,.07),transparent 55%),var(--bg)}
#gate.done{display:none}
.gbox{width:100%;max-width:430px}
.gbox .lg{display:flex;align-items:center;gap:9px;font-weight:800;font-size:17px;letter-spacing:.03em;margin-bottom:30px}
.gbox .lg svg{width:24px;height:24px;color:var(--lime)}
.gbox h1{font-size:clamp(1.5rem,4.4vw,2rem);line-height:1.15;margin-bottom:10px;letter-spacing:-.02em}
.gbox .hint{color:var(--mut);font-size:14.5px;line-height:1.6;margin-bottom:26px}
.gf{display:flex;gap:10px;flex-wrap:wrap}
#gpass{flex:1 1 190px;min-height:48px;padding:12px 16px;border-radius:12px;border:1px solid var(--bd2);
  background:var(--bg2);color:var(--txt);font-family:inherit;font-size:15px;letter-spacing:.08em}
#gpass::placeholder{color:var(--dim);letter-spacing:0}
#gpass:focus-visible{outline:2px solid var(--lime);outline-offset:2px}
#gerr{margin-top:14px;font-size:13.5px;color:#ff8f6b;min-height:1.3em}
#gerr.ok{color:var(--mut)}
.gnote{margin-top:34px;padding-top:18px;border-top:1px solid var(--bd);font-size:12px;color:var(--dim);line-height:1.6}
@media print{#gate{display:none}}
</style>
</head>
<body>

__DEFS__

<div id="gate">
  <div class="gbox">
    <div class="lg"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18V6l8 8 8-8v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"/></svg>GEN-GROUP</div>
    <h1>Внутренний документ</h1>
    <p class="hint">Материал к обсуждению собственников. Введите пароль, чтобы открыть.</p>
    <form class="gf" id="gform" autocomplete="off">
      <input id="gpass" type="password" placeholder="Пароль" aria-label="Пароль" autocomplete="off" spellcheck="false" enterkeyhint="go">
      <button type="submit" class="btn btn-lime" id="gbtn">Открыть</button>
    </form>
    <p id="gerr" role="status" aria-live="polite"></p>
    <p class="gnote">Документ зашифрован. Пароль никуда не передаётся и проверяется в вашем браузере. Без него текст нельзя извлечь ни из страницы, ни из её исходного кода.</p>
  </div>
</div>

<div id="doc"></div>

__PAYLOADS__
<script>
(function(){
  'use strict';
  var ITER = __ITER__;
  var TITLES = __TITLES__;          // ключ документа -> заголовок вкладки браузера
  var gate = document.getElementById('gate');
  var form = document.getElementById('gform');
  var pass = document.getElementById('gpass');
  var btn  = document.getElementById('gbtn');
  var err  = document.getElementById('gerr');
  var key = null;                   // ключ выводим один раз, дальше переключение мгновенное

  function b64(s){ var b = atob(s), a = new Uint8Array(b.length);
    for (var i=0;i<b.length;i++) a[i] = b.charCodeAt(i); return a; }

  if (!(window.crypto && window.crypto.subtle)) {
    err.textContent = 'Браузер не поддерживает расшифровку. Откройте в Chrome, Safari или Firefox.';
    pass.disabled = btn.disabled = true;
    return;
  }

  // Один документ в DOM за раз. Держать оба нельзя: у них совпадают
  // id разделов, #hd, #spine и #navd, и initDoc начнёт цеплять чужой.
  function open(name, focusTop){
    var el = document.getElementById('payload-' + name);
    if (!el) return Promise.reject(new Error('нет документа ' + name));
    var raw  = b64(el.textContent.trim());
    var salt = raw.slice(0, 16), iv = raw.slice(16, 28), data = raw.slice(28);
    return crypto.subtle.decrypt({ name:'AES-GCM', iv: iv }, key, data)
      .then(function(buf){
        var doc = document.getElementById('doc');
        doc.innerHTML = new TextDecoder().decode(buf);
        doc.setAttribute('data-doc', name);
        document.title = TITLES[name] || document.title;
        try { history.replaceState(null, '', '#' + name); } catch(e) {}
        window.scrollTo(0, 0);
        try { initDoc(); } catch(e) { console.error(e); }
        // вкладка перерисовала #doc целиком, патчи надо наложить заново
        if (window.BLOCKEDIT_REFRESH) { try { window.BLOCKEDIT_REFRESH(); } catch(e) { console.error(e); } }
        if (focusTop) {
          var h = document.getElementById('h-top');
          if (h) { h.setAttribute('tabindex','-1'); h.focus(); }
        }
      });
  }
  window.openDoc = open;

  // Переключатель вкладок живёт внутри шифра, поэтому слушаем делегированно
  document.addEventListener('click', function(ev){
    var t = ev.target.closest && ev.target.closest('[data-go]');
    if (!t || !key) return;
    ev.preventDefault();
    var name = t.getAttribute('data-go');
    if (document.getElementById('doc').getAttribute('data-doc') === name) return;
    open(name, true).catch(function(e){ console.error(e); });
  });

  form.addEventListener('submit', function(ev){
    ev.preventDefault();
    var p = pass.value;
    if (!p) return;
    btn.disabled = true;
    err.className = 'ok';
    err.textContent = 'Расшифровка...';

    // Соль и вектор берём из первого документа, ключ общий для всех
    var raw = b64(document.getElementById('payload-__FIRST__').textContent.trim());
    var salt = raw.slice(0, 16);

    crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveKey'])
      .then(function(km){
        return crypto.subtle.deriveKey(
          { name:'PBKDF2', salt: salt, iterations: ITER, hash:'SHA-256' },
          km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
      })
      .then(function(k){
        key = k;
        // тот же ключ уходит модулям правки и версий: патчи контента лежат в
        // Supabase шифрованными и открываются только этим паролем
        var patches = Promise.resolve();
        if (window.LIVEEDIT_KEY) {
          try { patches = window.LIVEEDIT_KEY(k) || Promise.resolve(); } catch(e) { console.error(e); }
        }
        // Ключи прошлых сборок выводим в фоне и отдаём модулю позже: они нужны
        // только для чтения правок, сохранённых до стабилизации соли.
        var alts = window.LIVEEDIT_ALT_SALTS || [];
        if (alts.length && window.LIVEEDIT_ALTKEYS) {
          Promise.all(alts.map(function(sb){
            var raw = b64(sb);
            return crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveKey'])
              .then(function(km){
                return crypto.subtle.deriveKey(
                  { name:'PBKDF2', salt: raw, iterations: ITER, hash:'SHA-256' },
                  km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
              });
          })).then(function(keys){ window.LIVEEDIT_ALTKEYS(keys); }, function(){});
        }
        var want = (location.hash || '').replace('#','');
        if (!document.getElementById('payload-' + want)) want = '__FIRST__';
        // Гейт снимаем только когда правки уже наложены. Иначе зал сначала
        // видит шаблонные цифры, а через полсекунды их подмену на глазах.
        err.textContent = 'Загружаю правки...';
        return Promise.all([open(want, true), patches]);
      })
      .then(function(){
        gate.classList.add('done');
        gate.remove();            // иначе на странице остаётся второй h1
      })
      .catch(function(){
        key = null;
        err.className = '';
        err.textContent = 'Пароль не подошёл.';
        btn.disabled = false;
        pass.select();
      });
  });

  pass.focus();
})();
</script>
<script>
function initDoc(){
__SCRIPT__
}
</script>
__LIVEEDIT__
</body>
</html>
`;

/**
 * Раскладка исходника на четыре части. Поддерживаются два вида вёрстки.
 *
 * v1: тело лежит прямо в body, инициализация в анонимной IIFE.
 * v2 (из Claude Design): тело уже завёрнуто в <div id="doc">, инициализация
 *     объявлена как function initDoc(){...} и вызывается последней строкой.
 *     Вызов при сборке убирается: в боевой странице initDoc() зовёт шлюз
 *     после расшифровки, а до неё звать нечего.
 */
function splitPlain(html) {
  const style = html.match(/<style>[\s\S]*?<\/style>/);
  const defs  = html.match(/<svg width="0" height="0"[\s\S]*?<\/svg>/);
  const body  = html.match(/<body>([\s\S]*?)<\/body>/);
  if (!style || !defs || !body) {
    console.error('не разобрал исходник: нет style, defs или body');
    process.exit(1);
  }

  const doc = body[1].match(/<div id="doc">([\s\S]*)<\/div><!-- \/#doc -->/);
  const initFn = html.match(/<script>[\s\S]*?function initDoc\(\)\{([\s\S]*?)\n\}\n(?:initDoc\(\);\n)?<\/script>/);
  const iife = html.match(/<script>\n\(function\(\)\{([\s\S]*?)\}\)\(\);\n<\/script>/);

  let secret, script;
  if (doc && initFn) {                       // v2
    secret = doc[1];
    script = initFn[1];
  } else if (iife) {                         // v1
    secret = body[1].replace(defs[0], '').replace(iife[0], '');
    script = iife[1];
  } else {
    console.error('не разобрал исходник: не нашёл ни initDoc(), ни IIFE');
    process.exit(1);
  }

  secret = secret.replace(defs[0], '')
                 .replace(/<a href="#main" class="skip">[\s\S]*?<\/a>/, '');
  return { style: style[0], defs: defs[0], secret: secret.trim(), script };
}

/**
 * Сборка страницы из одного или нескольких документов.
 *
 * Соль общая на все документы, вектор у каждого свой. Иначе при переключении
 * вкладок пришлось бы гонять PBKDF2 заново, а это 250 000 итераций и заметная
 * пауза. С общей солью ключ выводится один раз при вводе пароля, дальше
 * переключение стоит одну расшифровку AES.
 *
 * CSS, спрайт иконок и initDoc() берутся из первого документа: оформление
 * общее, а вёрстка второго обязана следовать тому же контракту имён.
 */
/* Соль берётся из уже собранной страницы, если она есть.
   Раньше каждая пересборкагенерировала новую, а из соли выводится ключ, которым
   зашифрованы правки в Supabase. То есть любая публикация делала все ранее
   сохранённые правки нечитаемыми. Соль не секрет, она и так лежит открыто в
   начале payload, поэтому её стабильность ничего не ослабляет. */
function saltFor(out) {
  try {
    const prev = fs.readFileSync(out, 'utf8');
    const m = prev.match(/<script id="payload(?:-[a-z0-9-]+)?"[^>]*>([\s\S]*?)<\/script>/);
    if (m) {
      const s = Buffer.from(m[1].trim(), 'base64').subarray(0, 16);
      if (s.length === 16) { console.log('соль взята из предыдущей сборки, ключ правок не меняется'); return s; }
    }
  } catch (e) { }
  console.log('соли не нашлось, генерирую новую: ранее сохранённые правки станут нечитаемыми');
  return crypto.randomBytes(16);
}

function lockAll(docs, out, password) {
  const salt = saltFor(out);
  const k = derive(password, salt);
  let first = null, payloads = [], titles = {}, report = [];

  for (const { name, file, title } of docs) {
    const part = splitPlain(fs.readFileSync(file, 'utf8'));
    if (!first) first = part;
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', k, iv);
    const ct = Buffer.concat([c.update(part.secret, 'utf8'), c.final(), c.getAuthTag()]);
    const payload = Buffer.concat([salt, iv, ct]).toString('base64');
    payloads.push(`<script id="payload-${name}" type="application/octet-stream">${payload}</script>`);
    titles[name] = title;
    report.push(`      ${name}: ${part.secret.length} симв. -> ${payload.length} симв. шифротекста`);
  }

  // Модуль правки блоков и версий. Подключается, только если задан LIVEEDIT_DOC:
  // ключ шифрования ему отдаёт гейт после ввода пароля, панели видны при ?edit=1.
  // Кода редактора в разметке нет намеренно: страница публичная, атрибут в ней
  // виден любому, а право писать проверяет Supabase по логину.
  // Соли прошлых сборок: страница пробует их, чтобы прочитать правки,
  // сохранённые до того, как соль стала стабильной.
  let altSalts = '[]';
  try {
    const p = __dirname + '/liveedit-salts.json';
    if (fs.existsSync(p)) {
      const cur = salt.toString('base64');
      const all = JSON.parse(fs.readFileSync(p, 'utf8')).filter(x => x !== cur);
      altSalts = JSON.stringify(all);
      if (all.length) console.log(`      запасных ключей из прошлых сборок: ${all.length}`);
    }
  } catch (e) { }

  const le = process.env.LIVEEDIT_DOC
    ? `<script src="${process.env.LIVEEDIT_SRC || 'liveedit/liveedit-init.js'}" ` +
      `data-doc="${process.env.LIVEEDIT_DOC}" data-root="#doc" data-crypt="wait" defer></script>` +
      `\n<script>window.LIVEEDIT_ALT_SALTS = ${altSalts};</script>`
    : '';

  const page = GATE
    .replace('__LIVEEDIT__', () => le)
    .replace('__STYLE__', () => first.style)
    .replace('__DEFS__', () => first.defs)
    .replace('__PAYLOADS__', () => payloads.join('\n'))
    .replace('__TITLES__', () => JSON.stringify(titles))
    .replace(/__FIRST__/g, () => docs[0].name)
    .replace('__ITER__', String(ITER))
    .replace('__SCRIPT__', () => first.script);

  fs.writeFileSync(out, page);
  console.log(`lock: ${docs.length} документ(ов), общая соль`);
  console.log(report.join('\n'));
  console.log(`      ${out}, ${Buffer.byteLength(page)} байт`);
}

function unlock(src, out, password) {
  const html = fs.readFileSync(src, 'utf8');
  const all = [...html.matchAll(/<script id="payload(?:-([a-z0-9-]+))?"[^>]*>([\s\S]*?)<\/script>/g)];
  if (!all.length) { console.error('в файле нет зашифрованной нагрузки'); process.exit(1); }

  for (const m of all) {
    const name = m[1] || 'doc';
    const raw = Buffer.from(m[2].trim(), 'base64');
    const salt = raw.subarray(0, 16), iv = raw.subarray(16, 28);
    const ct = raw.subarray(28, raw.length - 16), tag = raw.subarray(raw.length - 16);
    const d = crypto.createDecipheriv('aes-256-gcm', derive(password, salt), iv);
    d.setAuthTag(tag);
    let plain;
    try { plain = Buffer.concat([d.update(ct), d.final()]).toString('utf8'); }
    catch { console.error(`пароль не подошёл (${name})`); process.exit(1); }
    const dst = all.length === 1 ? out : out.replace(/(\.[^.]+)?$/, `-${name}$1`);
    fs.writeFileSync(dst, plain);
    console.log(`unlock: ${name}, ${plain.length} симв. -> ${dst}`);
  }
}

const USAGE = `node build-gate.js lock   <in.html> <out.html> <пароль>
node build-gate.js lock2  <gt.html> <gm.html> <out.html> <пароль>
node build-gate.js unlock <gated.html> <out.html> <пароль>

lock2 собирает переключатель предложений: GT & DG и GM & DG на одной
странице, один пароль, один ввод. При unlock многодокументной страницы
файлы пишутся как out-gt.html и out-gm.html.`;

const [, , mode, ...rest] = process.argv;

if (mode === 'lock2') {
  const [gt, gm, out, pw] = rest;
  if (!gt || !gm || !out || !pw) { console.error(USAGE); process.exit(1); }
  lockAll([
    { name: 'gt', file: gt, title: 'GT & DG' },
    { name: 'gm', file: gm, title: 'GM & DG' },
  ], out, pw);
} else if (mode === 'lock') {
  const [src, out, pw] = rest;
  if (!src || !out || !pw) { console.error(USAGE); process.exit(1); }
  lockAll([{ name: 'gt', file: src, title: 'GT & DG' }], out, pw);
} else if (mode === 'unlock') {
  const [src, out, pw] = rest;
  if (!src || !out || !pw) { console.error(USAGE); process.exit(1); }
  unlock(src, out, pw);
} else {
  console.error(USAGE);
  process.exit(1);
}
