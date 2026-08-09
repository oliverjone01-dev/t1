#!/usr/bin/env node
/**
 * Собирает gg-sales-academy/img/README.md из единственного источника
 * .claude/skills/kostya-ai/shared/situations.json.
 *
 * Промт склеивается тем же выражением, что и в build-library.mjs:
 * prompt_style.assembly.map(k => k === 'scene' ? s.scene : prompt_style[k]).join(' ')
 *
 * Запуск: node gg-sales-academy/src/build-img-readme.mjs
 * Проверка без записи: node gg-sales-academy/src/build-img-readme.mjs --check
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = new URL("../../.claude/skills/kostya-ai/shared/situations.json", import.meta.url);
const OUT = new URL("../img/README.md", import.meta.url);

const S = JSON.parse(readFileSync(SRC, "utf8"));

const prompt = (s) => {
  const st = S.prompt_style;
  if (!st || !Array.isArray(st.assembly)) {
    throw new Error("В situations.json нет prompt_style.assembly: промт не из чего собрать");
  }
  return st.assembly.map((k) => (k === "scene" ? s.scene : st[k])).join(" ");
};

const head = `# Картинки к типовым ситуациям

Сюда кладутся готовые иллюстрации. Деплой раскладывает эту папку в \`/academy/img/\`,
и её видят и библиотека, и кабинеты менеджеров: у всех страниц адрес внутри \`/academy/\`.

Пока файла нет, на странице стоит рамка с промтом и кнопкой копирования. Как только файл
появится под нужным именем, картинка встанет на место сама, верстать ничего не надо.

Этот файл собран из \`.claude/skills/kostya-ai/shared/situations.json\` и правится только там.
Промт в нём уже склеен: общий стилевой блок \`prompt_style\` плюс поле \`scene\` ситуации,
порядок частей задан массивом \`prompt_style.assembly\`.
`;

const block = (title, items) =>
  !items || !items.length ? "" : `\n## ${title}\n\n` + items.map((x) => `- ${x}`).join("\n") + "\n";

let out = head;

out += block("Требования", [
  "Имя файла: `<id>.webp`, ровно как в таблице ниже. Другое имя страница не подхватит.",
  "Размер " + S._size,
  ...(S._rules || []),
]);

out += block("Словарь приёмов", S._vocabulary);
out += block("Допуск приёмки", S._tolerance);
out += block("Как принимают выдачу", S._acceptance);

out += `
## Что нужно и промты

Промты продублированы на самих страницах: там их можно скопировать в один клик.
Единственный источник обоих мест - \`.claude/skills/kostya-ai/shared/situations.json\`.
`;

for (const s of S.situations || []) {
  out +=
    `\n### ${s.id}.webp\n\n` +
    `**Ситуация:** ${s.title}  \n` +
    `**Раздел:** ${s.section}  \n` +
    `**Alt для незрячих:** ${s.alt}  \n` +
    `**Приёмка:** ${s.check}\n\n` +
    "```\n" +
    prompt(s) +
    "\n```\n";
}

out += "\n";

if (process.argv.includes("--check")) {
  const cur = readFileSync(OUT, "utf8");
  if (cur === out) {
    console.log("README.md совпадает со сборкой из источника посимвольно");
  } else {
    console.error("README.md разошёлся с источником");
    process.exit(1);
  }
} else {
  writeFileSync(OUT, out);
  const words = (S.situations || []).map((s) => prompt(s).split(/\s+/).filter(Boolean).length);
  console.log(
    `Собрано ситуаций: ${(S.situations || []).length}. Длина промта: ${Math.min(...words)}-${Math.max(...words)} слов.`
  );
}
