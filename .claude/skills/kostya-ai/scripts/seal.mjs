#!/usr/bin/env node
// Kostya-AI: шифрование payload страницы паролем.
//
// Зачем не как на GEO-MONSTER. Там гейт сравнивает SHA-256 введённого пароля и
// показывает уже лежащий в HTML контент. Для SEO-разведки это честно названо
// «защитой от случайных глаз». Для персональных оценок сотрудников и цитат
// клиентской переписки этого мало: данные лежат в исходнике страницы, и любой,
// у кого есть ссылка, читает их через «просмотр кода» без всякого пароля.
//
// Здесь payload реально шифруется. В HTML попадает только шифротекст, соль и iv.
// Без пароля в файле нет ничего, что можно прочитать.
//
// Схема: PBKDF2-HMAC-SHA256, 600 000 итераций (рекомендация OWASP 2023),
// 32 байта соли -> ключ AES-256-GCM, 12 байт iv. На клиенте тот же WebCrypto,
// поэтому расхождения алгоритмов между сборкой и браузером невозможны.
//
// Чего схема НЕ даёт, говорить вслух:
//   - Пароль один на всех, кто его знает. Отзыв доступа = смена пароля и пересборка.
//   - Расшифрованную страницу можно сохранить, переслать, снять скриншот.
//   - Если файл утёк, пароль можно подбирать офлайн. Поэтому пароль длинный.
//
// Запуск: node seal.mjs payload.json "пароль" > payload.sealed.json

import { readFileSync } from "node:fs";

export const ITERATIONS = 600_000;

export async function seal(plaintext, password) {
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, password] = process.argv.slice(2);
  if (!file || !password) {
    console.error('Использование: node seal.mjs payload.json "пароль" > payload.sealed.json');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Пароль короче 12 знаков. Файл может утечь, подбор идёт офлайн.");
    process.exit(1);
  }
  const data = readFileSync(file);
  const out = await seal(data, password);
  process.stdout.write(JSON.stringify(out));
  console.error(`зашифровано: ${data.length} байт -> ${out.ct.length} base64`);
}
