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
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

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

// Проверка первая и главная: открытая часть страницы совпадает до символа с тем, что
// собирается из исходников (src/build.py --shell: шапка, стили пакета Контур DS и свои,
// разметка каркаса, окно пароля). Вне шифроблока не может оказаться ничего, чего нет в
// исходниках: ни комментария с цифрой, ни производного числа, ни обработчика событий.
// Страница собрана из других исходников, чем лежат рядом: публикация останавливается.
let shell;
try {
  shell = JSON.parse(execFileSync("python3", [fileURLToPath(new URL("../src/build.py", import.meta.url)), "--shell"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }));
} catch (e) { fail("Не удалось получить эталон открытой части (python3 src/build.py --shell): " + String(e.stderr || e.message).trim().slice(0, 300)); }
const openSrc = html.slice(0, a) + html.slice(b + CLOSE.length), want = shell.prefix + shell.suffix;
if (openSrc !== want) {
  let i = 0; while (i < openSrc.length && openSrc[i] === want[i]) i++;
  fail("Вне шифроблока страница расходится с исходниками с символа " + i
    + ": в странице «" + openSrc.slice(i, i + 80).replace(/\s+/g, " ") + "», в исходниках «" + want.slice(i, i + 80).replace(/\s+/g, " ")
    + "». Пересобери страницу (python3 src/build.py) и не правь public/index.html руками.");
}

// Второй слой, на случай если утечка попадёт в сами исходники открытой части.
// Скрипты вне шифра: ровно ApexCharts по закреплённому адресу и окно пароля.
const openPart = out.replace(/<script id="app-sealed" type="application\/json">[^<]*<\/script>\n/, "");
const APEX = "https://cdnjs.cloudflare.com/ajax/libs/apexcharts/3.54.1/apexcharts.min.js";
const scripts = [...openPart.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
const allowed = (attrs, body) =>
  (/\bintegrity="sha384-[A-Za-z0-9+/=]+"/.test(attrs) && (attrs.match(/\bsrc="([^"]*)"/) || [])[1] === APEX && !body.trim()) ||
  (!/\bsrc=/.test(attrs) && body.includes("getElementById('app-sealed')"));
const extra = scripts.filter(([, attrs, body]) => !allowed(attrs, body));
if (extra.length) fail("Вне шифроблока лишний скрипт: " + extra[0][0].slice(0, 80));
if (scripts.length !== 2) fail("Вне шифроблока скриптов " + scripts.length + ", а должно быть ровно два: ApexCharts и окно пароля.");
// Обработчики событий в атрибутах исполняются так же, как скрипт: <img onerror>,
// <svg/onload>, в любом регистре.
const handler = openPart.match(/<[^>]*[\s/"']on[a-z]+\s*=/i);
if (handler) fail("Вне шифроблока обработчик события в атрибуте: " + handler[0].slice(0, 80));
const m = code.match(/const DB = (\{.*?\});\n/s);
if (!m) fail("В блоке app-js нет данных DB: сборка страницы изменилась, проверка невозможна.");
const db = JSON.parse(m[1]);
// Имена проектов и домены публичны и стоят в разметке переключателя проектов.
const PUBLIC = new Set(Object.values(db.projects || {}).flatMap(p => [p.name, p.dom]));
// Параметры шифра открыто названы в окне пароля (AES-256, SHA-256, 600 000 итераций):
// совпадение с таким числом в данных не утечка.
const PUBLIC_NUM = new Set([256, ITERATIONS]);

// Стили пакета Контур DS пропускаются, только если это ровно файлы закреплённой версии
// пакета: sha256 блока равен записанному здесь. Правило content:"175 968 ₽" в kit.css
// меняет хэш, и публикация останавливается с прямой причиной. Новая версия пакета: пересчитать
// хэши (команда в docs/RUNBOOK.md, «Что проверяет шифровальщик») и записать сюда.
const PINNED = {
  "ks-tokens": "d735d2032c1b50ad6efcd9540284de27996a861c8cfc5d01a66f7c50cdef9ef8",
  "ks-kit":    "ca434457bf1842091942d7494ea199aa7950eb6bf25ff7c9b6b8d2ce58a8b4d6",
};
const sha = t => createHash("sha256").update(t, "utf8").digest("hex");
// Текст для поиска: разметка и текст как есть; у стилей и скрипта окна пароля только
// комментарии и строки (объявления CSS и код не данные, а в них полно чисел вида 400 и 1024).
for (const id of Object.keys(PINNED)) {
  const blk = openPart.match(new RegExp('<style id="' + id + '">\\n([\\s\\S]*?)\\n</style>'));
  if (!blk || sha(blk[1]) !== PINNED[id])
    fail("Стили пакета Контур DS (" + id + ") не совпадают с закреплённой версией: пакет правили или обновили. "
      + "Проверь правку и пересчитай хэши в tools/seal_page.mjs (docs/RUNBOOK.md, «Что проверяет шифровальщик»).");
}
let scan = openPart.replace(/<style id="(ks-tokens|ks-kit)">[\s\S]*?<\/style>/g, " ");
const keepTalk = t => (t.match(/\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`/g) || []).join(" ");
scan = scan.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (a0, o, body, c) => o + keepTalk(body) + c)
  .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (a0, o, body, c) => o + keepTalk(body) + c)
  // служебные атрибуты: адрес шрифта (wght@400;500), геометрия иконок, цвет темы
  .replace(/<(link|meta)\b[^>]*>/gi, " ").replace(/\s(d|viewBox|width|height|stroke-width)="[^"]*"/g, " ")
  .replace(/#[0-9a-fA-F]{3,8}\b/g, "#");
const openText = scan;
const leaks = new Set();
const SEP = [" ", "\u00a0", "\u202f", "\u2009"];
const grp = (i, sp) => i.replace(/\B(?=(\d{3})+(?!\d))/g, sp);
const dec = (x, d) => x.toFixed(d).replace(/\.?0+$/, "").replace(".", ",");
(function walk(o) {
  if (o == null) return;
  if (typeof o === "number" && Math.abs(o) >= 100 && !PUBLIC_NUM.has(Math.abs(o))) {
    // Число ищется в сыром виде, с разрядами через любой пробел, как их печатает nf(),
    // и в коротких формах: тыс., млн, млрд.
    const x = Math.abs(o), i = String(Math.trunc(x));
    const forms = [String(o), ...SEP.map(sp => grp(i, sp))];
    for (const sp of SEP) {
      if (x >= 1e4) forms.push(dec(x / 1e3, 0) + sp + "тыс", dec(x / 1e3, 1) + sp + "тыс");
      if (x >= 1e6) forms.push(dec(x / 1e6, 0) + sp + "млн", dec(x / 1e6, 1) + sp + "млн", dec(x / 1e6, 2) + sp + "млн");
      if (x >= 1e8) forms.push(dec(x / 1e9, 1) + sp + "млрд", dec(x / 1e9, 2) + sp + "млрд");
    }
    for (const f of new Set(forms)) {
      const re = new RegExp("(?<![\\w.,])" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w]|,\\d)");
      if (re.test(openText)) { leaks.add(f); break; }
    }
  } else if (typeof o === "string" && o.length >= 8 && !PUBLIC.has(o)) {
    if (openText.includes(o)) leaks.add(o.slice(0, 40));
  } else if (typeof o === "object") Object.values(o).forEach(walk);
})(db);
if (leaks.size) fail("Вне шифроблока нашлись значения из данных: " + [...leaks].slice(0, 5).join(" | "));
writeFileSync(file, out);
console.error(`зашифровано: ${code.length} символов приложения, файл ${out.length} символов`);
