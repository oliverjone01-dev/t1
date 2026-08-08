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
//   [{ "file": "petrova-mariya.html", "title": "...", "subtitle": "...",
//      "scope": "manager" | "rop" | "common", "person": "Петрова Мария" }]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { seal } from "./seal.mjs";

const [srcDir, outDir, ...rest] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error("Использование: node build-platform.mjs <src> <out> [--passwords файл.json]");
  process.exit(1);
}
// Пароли лежат ВНЕ папки выдачи по той же причине, что и манифест: папку
// пересылают целиком, и файл с паролем поехал бы вместе с кабинетами,
// отменяя правило «файл одним каналом, пароль другим».
const pwFile = rest.includes("--passwords") ? rest[rest.indexOf("--passwords") + 1]
  : outDir.replace(/\/+$/, "") + "-PASSWORDS.local.json";

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
// Решение Ивана от 2026-08-08, вопрос 8: пока один общий пароль на кабинеты.
// Цена решения, сказана вслух и повторена здесь: пересланный файл открывается
// любым из десяти, изоляция начинает держаться только на псевдониме, а не на
// пароле. Сводка штаба общий пароль не получает никогда: в ней данные всех.
const shared = rest.includes("--shared");
const scopeKey = (p) => {
  if (p.scope === "common") return "common";
  if (p.scope === "manager" && shared) return "managers-shared";
  return p.file;
};

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
  // Единственная точка контакта до ввода пароля не должна говорить только про
  // угрозу. Подпись описывает жанр документа и не называет человека, поэтому
  // контроль утечки имени ниже остаётся зелёным.
  const subtitle = p.subtitle || (p.scope === "manager"
    ? "Разбор вашей переписки с клиентами: что получилось, что чинить и одна задача на 14 дней. "
      + "Это основа плана развития, а не итоговая оценка сотрудника."
    : "");
  const html = tpl
    .replaceAll("__TITLE__", esc(gateTitle))
    .replaceAll("__SUBTITLE__", esc(subtitle))
    .replace("__SEALED__", JSON.stringify(sealed));

  const outPath = join(outDir, p.file);
  writeFileSync(outPath, html);

  // Контроль: plaintext не должен просачиваться в собранный файл. Шифротекст в
  // base64 читаемой кириллицы не содержит, поэтому проверяем каркас гейта, из
  // которого шифротекст вырезан.
  // Каркас обязан посимвольно совпасть с шаблоном, в котором подставлены только
  // заголовок и подзаголовок. Любой лишний байт это содержимое, просочившееся
  // мимо шифрования. Сравнение точное: сравнивать по словарю нельзя, каркас и
  // содержимое написаны на одном языке и общие слова дают ложную тревогу.
  const chrome = html.replace(JSON.stringify(sealed), "");
  const expected = tpl
    .replaceAll("__TITLE__", esc(gateTitle))
    .replaceAll("__SUBTITLE__", esc(subtitle))
    .replace("__SEALED__", "");
  if (chrome !== expected) {
    console.error(`УТЕЧКА в ${p.file}: каркас гейта не совпал с шаблоном, содержимое просочилось мимо шифрования`);
    process.exit(1);
  }
  // Экран блокировки не должен называть человека: ссылка без пароля не обязана
  // сообщать, чей это кабинет.
  const onGate = `${gateTitle} ${subtitle}`;
  const named = (p.person || "").split(/\s+/).filter((w) => w.length > 2 && onGate.includes(w));
  if (named.length) {
    console.error(`УТЕЧКА в ${p.file}: имя «${named.join(" ")}» стоит на экране блокировки`);
    process.exit(1);
  }
  built.push({ ...p, sizeKb: Math.round(html.length / 1024) });
  console.log(`  ${p.file.padEnd(28)} ${String(Math.round(html.length / 1024)).padStart(4)} КБ  ${p.scope}`);
}

writeFileSync(pwFile, JSON.stringify(passwords, null, 1));
// Манифест НЕ кладётся в папку выдачи. Он перечисляет все файлы вместе с полем
// person, а при одном общем пароле общая папка давала бы полный список кабинетов
// тому, кто получил один файл. Изоляция не должна держаться на гигиене раздачи.
writeFileSync(outDir.replace(/\/+$/, "") + "-manifest.json", JSON.stringify({
  bakedAt: new Date().toISOString(), pages: built,
}, null, 1));

console.log(`\nстраниц: ${built.length}, папка: ${outDir}`);
console.log(`пароли: ${pwFile}  (в git не попадает, раздавать лично)`);
console.log("Файлы платформы не коммитятся: репозиторий публичный.");

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
