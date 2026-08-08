#!/usr/bin/env node
// Kostya-AI: сборка учебной платформы из готовых HTML-страниц.
//
// Берёт папку с несобранными страницами, шифрует каждую своим паролем и
// выкладывает готовые файлы с гейтом. Пароли генерирует сам и пишет в отдельный
// файл, который в git не попадает.
//
// Модель доступа при статике без бэкенда. Ролей три, а сервера нет, поэтому
// роль определяется НЕ проверкой на клиенте (её обходят), а тем, какой файл
// человеку выдали и каким паролем он открывается:
//   - у менеджера свой файл со своим паролем, внутри только его данные;
//   - у РОПа и Ивана отдельный файл со сводкой;
//   - общие учебные разделы без персональных данных, один пароль на отдел.
// Менеджер физически не может увидеть данные коллеги: их нет в его файле, и его
// пароль не открывает чужой.
//
// Запуск:
//   node build-platform.mjs <папка-с-исходными-страницами> <папка-выхода> [--passwords имя.json]
//
// Формат исходной страницы: обычный HTML. Рядом лежит pages.json с описанием:
//   [{ "file": "lakomova-tatyana.html", "title": "...", "subtitle": "...",
//      "scope": "manager" | "rop" | "common", "person": "Лакомова Татьяна" }]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { seal } from "./seal.mjs";

const [srcDir, outDir, ...rest] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error("Использование: node build-platform.mjs <src> <out> [--passwords файл.json]");
  process.exit(1);
}
const pwFile = rest.includes("--passwords") ? rest[rest.indexOf("--passwords") + 1] : join(outDir, "PASSWORDS.local.json");

// Пароль читаемый вслух и достаточно длинный, чтобы офлайн-подбор был дорогим.
// Слова простые, без похожих букв: пароль диктуют по телефону.
const WORDS = ["сталь", "стекло", "профиль", "кромка", "петля", "рама", "полка", "опора",
  "триплекс", "фацет", "матовый", "бронза", "графит", "латунь", "монтаж", "замер",
  "чертёж", "эскиз", "партия", "отгрузка", "склад", "цех", "станок", "шаблон"];
function makePassword() {
  const pick = () => WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length];
  const num = 100 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900);
  return `${pick()}-${pick()}-${pick()}-${num}`;
}

const manifestPath = join(srcDir, "pages.json");
if (!existsSync(manifestPath)) {
  console.error(`Нет ${manifestPath}. Опишите страницы перед сборкой.`);
  process.exit(1);
}
const pages = JSON.parse(readFileSync(manifestPath, "utf8"));
const tpl = readFileSync(new URL("./gate.html", import.meta.url), "utf8");

mkdirSync(outDir, { recursive: true });

// Пароли переиспользуем, если файл уже есть: пересборка не должна менять пароль,
// который человеку уже продиктовали.
let passwords = existsSync(pwFile) ? JSON.parse(readFileSync(pwFile, "utf8")) : {};
const scopeKey = (p) => (p.scope === "common" ? "common" : p.file);

const built = [];
for (const p of pages) {
  const srcPath = join(srcDir, p.file);
  if (!existsSync(srcPath)) { console.error(`пропущено, нет файла: ${p.file}`); continue; }
  const inner = readFileSync(srcPath, "utf8");
  // Из готовой страницы берём только содержимое body плюс её стили: гейт даёт
  // свой каркас документа.
  const style = (inner.match(/<style>[\s\S]*?<\/style>/) || [""])[0];
  const bodyM = inner.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const payload = style + "\n" + (bodyM ? bodyM[1] : inner);

  const key = scopeKey(p);
  if (!passwords[key]) passwords[key] = makePassword();
  const sealed = await seal(Buffer.from(payload, "utf8"), passwords[key]);

  // На экране блокировки имя человека не показываем. Иначе любой, у кого есть
  // ссылка, узнаёт, чей это кабинет, не зная пароля. Имя появляется после входа.
  const gateTitle = p.scope === "manager" ? "Кабинет менеджера" : p.title;
  const html = tpl
    .replaceAll("__TITLE__", esc(gateTitle))
    .replaceAll("__SUBTITLE__", esc(p.subtitle || ""))
    .replace("__SEALED__", JSON.stringify(sealed));

  const outPath = join(outDir, p.file);
  writeFileSync(outPath, html);

  // Контроль: plaintext не должен просачиваться в собранный файл. Слова из
  // заголовка гейта исключаем, они на экране блокировки стоят намеренно.
  const visible = new Set((gateTitle + " " + (p.subtitle || "")).match(/[А-Яа-яЁё]{4,}/g) || []);
  const probe = (payload.match(/[А-Яа-яЁё]{8,}/g) || [])
    .filter((w) => !visible.has(w)).slice(0, 60);
  const leak = probe.filter((w) => html.includes(w));
  if (leak.length) {
    console.error(`УТЕЧКА в ${p.file}: ${leak.slice(0, 3).join(", ")}`);
    process.exit(1);
  }
  built.push({ ...p, sizeKb: Math.round(html.length / 1024) });
  console.log(`  ${p.file.padEnd(28)} ${String(Math.round(html.length / 1024)).padStart(4)} КБ  ${p.scope}`);
}

writeFileSync(pwFile, JSON.stringify(passwords, null, 1));
writeFileSync(join(outDir, "manifest.json"), JSON.stringify({
  bakedAt: new Date().toISOString(), pages: built,
}, null, 1));

console.log(`\nстраниц: ${built.length}, папка: ${outDir}`);
console.log(`пароли: ${pwFile}  (в git не попадает, раздавать лично)`);
console.log("Файлы платформы не коммитятся: репозиторий публичный.");

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
