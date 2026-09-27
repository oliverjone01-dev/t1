// Шифрование данных страницы паролем: PBKDF2-SHA256 + AES-256-GCM, те же параметры, что у WebCrypto в браузере.
// Вход: stdin (JSON), пароль в переменной GM_PAGE_PASSWORD. Выход: JSON {salt, iv, iter, ct} в base64.
const ITER = 310000;
const pass = process.env.GM_PAGE_PASSWORD;
if (!pass) { console.error('нет GM_PAGE_PASSWORD'); process.exit(1); }
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const plain = Buffer.concat(chunks);
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base,
  { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
const b64 = a => Buffer.from(a).toString('base64');
process.stdout.write(JSON.stringify({ salt: b64(salt), iv: b64(iv), iter: ITER, ct: b64(ct) }));
