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

<script id="payload" type="application/octet-stream">__PAYLOAD__</script>
<script>
(function(){
  'use strict';
  var ITER = __ITER__;
  var gate = document.getElementById('gate');
  var form = document.getElementById('gform');
  var pass = document.getElementById('gpass');
  var btn  = document.getElementById('gbtn');
  var err  = document.getElementById('gerr');

  function b64(s){ var b = atob(s), a = new Uint8Array(b.length);
    for (var i=0;i<b.length;i++) a[i] = b.charCodeAt(i); return a; }

  if (!(window.crypto && window.crypto.subtle)) {
    err.textContent = 'Браузер не поддерживает расшифровку. Откройте в Chrome, Safari или Firefox.';
    pass.disabled = btn.disabled = true;
    return;
  }

  form.addEventListener('submit', function(ev){
    ev.preventDefault();
    var p = pass.value;
    if (!p) return;
    btn.disabled = true;
    err.className = 'ok';
    err.textContent = 'Расшифровка...';

    var raw  = b64(document.getElementById('payload').textContent.trim());
    var salt = raw.slice(0, 16), iv = raw.slice(16, 28), data = raw.slice(28);

    crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveKey'])
      .then(function(km){
        return crypto.subtle.deriveKey(
          { name:'PBKDF2', salt: salt, iterations: ITER, hash:'SHA-256' },
          km, { name:'AES-GCM', length:256 }, false, ['decrypt']);
      })
      .then(function(key){ return crypto.subtle.decrypt({ name:'AES-GCM', iv: iv }, key, data); })
      .then(function(buf){
        document.getElementById('doc').innerHTML = new TextDecoder().decode(buf);
        gate.classList.add('done');
        gate.remove();            // иначе на странице остаётся второй h1
        document.title = 'ИНТЕГРА 2.0';
        // innerHTML не исполняет вложенные script, инициализацию зовём сами
        try { initDoc(); } catch(e) { console.error(e); }
        var h = document.getElementById('h-top');
        if (h) { h.setAttribute('tabindex','-1'); h.focus(); }
      })
      .catch(function(){
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
</body>
</html>
`;

function splitPlain(html) {
  const style  = html.match(/<style>[\s\S]*?<\/style>/);
  const defs   = html.match(/<svg width="0" height="0"[\s\S]*?<\/svg>/);
  const body   = html.match(/<body>([\s\S]*?)<\/body>/);
  const script = html.match(/<script>\n\(function\(\)\{([\s\S]*?)\}\)\(\);\n<\/script>/);
  if (!style || !defs || !body || !script) {
    console.error('не разобрал исходник: нет style/defs/body/script');
    process.exit(1);
  }
  let secret = body[1].replace(defs[0], '').replace(script[0], '')
                      .replace(/<a href="#main" class="skip">[\s\S]*?<\/a>/, '');
  return { style: style[0], defs: defs[0], secret: secret.trim(), script: script[1] };
}

function lock(src, out, password) {
  const { style, defs, secret, script } = splitPlain(fs.readFileSync(src, 'utf8'));
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', derive(password, salt), iv);
  const ct = Buffer.concat([c.update(secret, 'utf8'), c.final(), c.getAuthTag()]);
  const payload = Buffer.concat([salt, iv, ct]).toString('base64');
  const page = GATE.replace('__STYLE__', () => style).replace('__DEFS__', () => defs)
                   .replace('__PAYLOAD__', () => payload).replace('__ITER__', String(ITER))
                   .replace('__SCRIPT__', () => script);
  fs.writeFileSync(out, page);
  console.log(`lock: ${secret.length} симв. открытого текста -> ${payload.length} симв. шифротекста`);
  console.log(`      ${out}, ${Buffer.byteLength(page)} байт`);
}

function unlock(src, out, password) {
  const m = fs.readFileSync(src, 'utf8').match(/<script id="payload"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) { console.error('в файле нет зашифрованной нагрузки'); process.exit(1); }
  const raw = Buffer.from(m[1].trim(), 'base64');
  const salt = raw.subarray(0, 16), iv = raw.subarray(16, 28);
  const ct = raw.subarray(28, raw.length - 16), tag = raw.subarray(raw.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', derive(password, salt), iv);
  d.setAuthTag(tag);
  let plain;
  try { plain = Buffer.concat([d.update(ct), d.final()]).toString('utf8'); }
  catch { console.error('пароль не подошёл'); process.exit(1); }
  fs.writeFileSync(out, plain);
  console.log(`unlock: ${plain.length} симв. -> ${out}`);
}

const [, , mode, src, out, pw] = process.argv;
if (!['lock', 'unlock'].includes(mode) || !src || !out || !pw) {
  console.error('node build-gate.js lock|unlock <in.html> <out.html> <пароль>');
  process.exit(1);
}
(mode === 'lock' ? lock : unlock)(src, out, pw);
