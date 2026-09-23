#!/usr/bin/env node
// Шифрует приложение Контура паролем перед публикацией.
//
// Весь основной скрипт страницы (данные, экраны, оболочка) заменяется блоком
// app-sealed с шифротекстом. В опубликованном файле остаются только стили,
// пустая разметка и окно пароля: без пароля в нём нет ни одного числа.
//
// Схема та же, что у академии (.claude/skills/kostya-ai/scripts/seal.mjs):
// PBKDF2-HMAC-SHA256, 600 000 итераций, 32 байта соли, AES-256-GCM, 12 байт iv.
// Расшифровывает окно пароля в src/modules/shell.py тем же WebCrypto.
//
// Чего схема не даёт: пароль один на всех; расшифрованную страницу можно
// сохранить и переслать; утёкший файл можно подбирать офлайн, поэтому пароль
// не короче 12 знаков.
//
// Запуск: KONTUR_PASS=... node tools/seal_page.mjs <файл.html>   (файл меняется на месте)
//
// Секрет свой, а не общий пароль хаба: /seo/ публикует быстрый SHA-256 от общего
// пароля, и по нему пароль подбирался бы офлайн в обход PBKDF2.

import { readFileSync, writeFileSync } from "node:fs";

const ITERATIONS = 600_000;
const OPEN = '<script id="app-js">\n';
const CLOSE = "\n</script>\n";

async function seal(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const km = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const b64 = (b) => Buffer.from(b).toString("base64");
  return { v: 1, kdf: "PBKDF2-SHA256", iter: ITERATIONS,
           salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

function fail(msg) { console.error(msg); process.exit(1); }

const file = process.argv[2];
const password = process.env.KONTUR_PASS || "";
if (!file) fail("Использование: KONTUR_PASS=... node tools/seal_page.mjs <файл.html>");
if (password.length < 12) fail("KONTUR_PASS короче 12 знаков: утёкший файл подбирается офлайн, публикация остановлена.");
// Пароли, которые уже лежат открытым текстом в этом публичном репозитории
// (дефолт хаба, gg-seo-geo-monster/README.md). С таким паролем шифр ничего не закрывает.
// Сравнение без регистра и по корню: «Genmonster2026!» подбирается тем же словарём.
const KNOWN_PUBLIC = ["genmonster"];
if (KNOWN_PUBLIC.some(w => password.toLowerCase().includes(w))) fail("KONTUR_PASS построен на пароле, опубликованном в репозитории, публикация остановлена.");
// Общий пароль хаба нельзя: /seo/ публикует его быстрый SHA-256, по нему пароль
// подбирается офлайн в обход PBKDF2. Шаг публикации передаёт HUB_PASS только для сверки.
if (process.env.HUB_PASS && process.env.HUB_PASS === password) fail("KONTUR_PASS совпадает с HUB_PASS, публикация остановлена.");

const html = readFileSync(file, "utf8");
const a = html.indexOf(OPEN);
if (a < 0) fail("В странице нет блока app-js: нечего шифровать.");
const b = html.indexOf(CLOSE, a + OPEN.length);
if (b < 0) fail("Блок app-js не закрыт.");
const code = html.slice(a + OPEN.length, b);

const sealed = await seal(new TextEncoder().encode(code), password);
// JSON шифротекста состоит из base64 и цифр, закрывающего тега в нём быть не может.
const out = html.slice(0, a)
  + '<script id="app-sealed" type="application/json">' + JSON.stringify(sealed) + "</script>\n"
  + html.slice(b + CLOSE.length);

// Проверка разрешающая. Открытая часть страницы - это стили Контур DS, разметка
// и ровно два скрипта: apexcharts с CDN и окно пароля. Кит DS лежит в шифроблоке
// вместе с приложением. Любой другой скрипт вне шифроблока - повод остановить публикацию.
const openPart = out.replace(/<script id="app-sealed" type="application\/json">[^<]*<\/script>\n/, "");
const scripts = [...openPart.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const allowed = (attrs, body) =>
  (/src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/apexcharts\//.test(attrs) && !body.trim()) ||
  (!/\bsrc=/.test(attrs) && body.includes("getElementById('app-sealed')"));
const extra = scripts.filter(([, attrs, body]) => !allowed(attrs, body));
if (extra.length) fail("Вне шифроблока лишний скрипт: " + extra[0][0].slice(0, 80));
const m = code.match(/const DB = (\{.*?\});\n/s);
if (!m) fail("В блоке app-js нет данных DB: сборка страницы изменилась, проверка невозможна.");
const db = JSON.parse(m[1]);
// Имена проектов и домены публичны и стоят в разметке переключателя проектов.
const PUBLIC = new Set(Object.values(db.projects || {}).flatMap(p => [p.name, p.dom]));
// Цвета CSS вида #232830 и комментарии кита («подсветка», «данные») не данные:
// убираем их, а числа ищем целым токеном. Комментарии пишет сборка, а не выгрузка.
const openText = openPart.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/#[0-9a-fA-F]{3,8}\b/g, "#");
const leaks = new Set();
(function walk(o) {
  if (o == null) return;
  if (typeof o === "number" && Math.abs(o) >= 1000) {
    // Число ищется и в сыром виде, и в экранном: разряды через пробел или
    // неразрывный пробел, как их печатает nf(), и в миллионах.
    const i = String(Math.trunc(Math.abs(o)));
    const forms = [String(o), i.replace(/\B(?=(\d{3})+(?!\d))/g, " "), i.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")];
    if (Math.abs(o) >= 1e6 && Math.abs(o) % 1e6 === 0) forms.push(Math.abs(o) / 1e6 + " млн", Math.abs(o) / 1e6 + "\u00a0млн");
    for (const f of forms) {
      const re = new RegExp("(?<![\\w.])" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w])");
      if (re.test(openText)) { leaks.add(f); break; }
    }
  } else if (typeof o === "string" && o.length >= 8 && !PUBLIC.has(o)) {
    if (openText.includes(o)) leaks.add(o.slice(0, 40));
  } else if (typeof o === "object") Object.values(o).forEach(walk);
})(db);
if (leaks.size) fail("Вне шифроблока нашлись значения из данных: " + [...leaks].slice(0, 5).join(" | "));
writeFileSync(file, out);
console.error(`зашифровано: ${code.length} символов приложения, файл ${out.length} символов`);
