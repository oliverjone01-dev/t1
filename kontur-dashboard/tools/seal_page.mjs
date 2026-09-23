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

if (out.includes("const DB = ") || out.includes('id="app-js"')) fail("После шифрования в странице остались открытые данные.");
writeFileSync(file, out);
console.error(`зашифровано: ${code.length} символов приложения, файл ${out.length} символов`);
