#!/usr/bin/env node
// Kostya-AI: псевдонимизация сотрудников.
//
// Решение Ивана от 2026-08-08, вопрос 3: до визы юриста имена сотрудников в
// артефактах заменяются вымышленными, таблица соответствия выдаётся отдельно и
// только Ивану.
//
// ЧЕГО ЭТО НЕ ДАЁТ, говорить вслух и писать в шапке кабинета.
// Псевдоним закрывает случайного читателя и внешнего. Он НЕ обезличивает файл,
// в котором остались номера сделок, суммы и цитаты клиентской переписки: любой
// сотрудник с доступом в Bitrix открывает сделку 98173 и видит владельца за
// секунду. Убрать номера нельзя, переход в Bitrix это главная ценность кабинета.
// То есть это защита от внешнего наблюдателя, а не от коллеги.
//
// Псевдоним детерминирован: одно и то же имя всегда даёт один и тот же псевдоним,
// потому что человек не должен менять имя между сборками. Соответствие хранится в
// файле и переиспользуется, новые люди дописываются.
//
// Запуск:
//   node pseudonymize.mjs map --roster roster.json --out ~/gg-academy-keys/pseudonyms.json
//   node pseudonymize.mjs apply файл.html --map таблица.json [--owner "Фамилия Имя"] [--scoped]
//   node pseudonymize.mjs check файл.html --map таблица.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ─────────────────────────────────────────── словари

// Пул псевдонимов. Мужские и женские перечислены явно, а не выводятся по
// окончанию: «Никита» и «Илья» заканчиваются на гласную и по формальному правилу
// попали бы в женские.
const FEM_FIRST = ["Анна", "Марина", "Вера", "Дарья", "Елена", "Ксения", "Лидия",
  "Полина", "Алина", "София", "Инга", "Тамара"];
const MAL_FIRST = ["Игорь", "Павел", "Сергей", "Никита", "Артём", "Роман",
  "Денис", "Максим", "Тимур", "Виктор", "Олег", "Егор"];
const FEM_LAST = ["Соколова", "Ветрова", "Зимина", "Рогова", "Астахова",
  "Северцева", "Асеева", "Мельникова", "Гончарова", "Лапина"];
const MAL_LAST = ["Дементьев", "Ершов", "Клюев", "Полев", "Лобанов",
  "Тихонов", "Кораблёв", "Дроздов", "Ремизов", "Гончаров"];

const POOL = { f: [], m: [] };
for (const l of FEM_LAST) for (const n of FEM_FIRST) POOL.f.push(`${n} ${l}`);
for (const l of MAL_LAST) for (const n of MAL_FIRST) POOL.m.push(`${n} ${l}`);

// Список личных имён нужен, чтобы понять, какое из двух слов фамилия. Выгрузка
// Bitrix даёт «Фамилия Имя», снимок сделок «Имя Фамилия», порядок не фиксирован.
const FIRST_NAMES = new Set(["александр", "александра", "алексей", "алина", "алиса",
  "алла", "алена", "анастасия", "анатолий", "андрей", "анна", "антон", "артем",
  "артур", "борис", "вадим", "валентина", "валерий", "валерия", "василий", "вера",
  "виктор", "виктория", "виталий", "владимир", "владислав", "вячеслав", "галина",
  "григорий", "дарья", "денис", "диана", "дмитрий", "евгений", "евгения", "егор",
  "екатерина", "елена", "елизавета", "жанна", "зоя", "иван", "игорь", "илья",
  "инга", "инна", "ирина", "кирилл", "константин", "кристина", "ксения", "лариса",
  "леонид", "лидия", "любовь", "людмила", "маргарита", "марина", "мария", "марк",
  "максим", "михаил", "надежда", "наталия", "наталья", "никита", "николай", "нина",
  "оксана", "олег", "ольга", "павел", "петр", "полина", "раиса", "регина", "роман",
  "руслан", "светлана", "семен", "сергей", "софия", "софья", "станислав", "степан",
  "тамара", "татьяна", "тимур", "федор", "эдуард", "элина", "эльвира", "юлия",
  "юрий", "яна", "ярослав"]);

// Мужские имена на гласную: формальное правило «кончается на -а/-я значит женское»
// на них ломается.
const MALE_EXC = /^(никита|илья|фома|кузьма|данила|савва|лука|гаврила)$/u;
const FEM_SUR = /(ова|ева|ёва|ина|ына|ская|цкая|ая)$/u;
const MAL_SUR = /(ов|ев|ёв|ин|ын|ский|цкий|ой|ый|ий)$/u;
// Фамилии, которые не склоняются и не показывают пол: Лысенко, Турченко, Элчи.
const SUR_SHAPE = /(ов|ев|ёв|ин|ын|ский|цкий|ова|ева|ёва|ина|ына|ская|цкая|ая|ко|ук|юк|ых|их|ун|арь)$/u;

// Не человек: системные учётки Bitrix. Псевдоним для них вреден вдвойне: читатель
// решит, что сделку вёл сотрудник, тогда как её завела миграция.
const NOT_A_PERSON = /(систем|робот|интеграц|миграц|\bбот\b|admin|test)/iu;

const norm = (s) => (s || "").trim().replace(/\s+/g, " ");
const low = (s) => (s || "").toLowerCase().replace(/ё/g, "е");

// ─────────────────────────────────────────── разбор имени

/** Делит «Имя Фамилия» или «Фамилия Имя» на части. Порядок в источнике не фиксирован. */
export function splitName(fullName) {
  const w = norm(fullName).split(" ").filter(Boolean);
  if (w.length < 2) return { first: w[0] || "", last: "", order: "fl" };
  const [a, b] = w;
  const aF = FIRST_NAMES.has(low(a)), bF = FIRST_NAMES.has(low(b));
  if (aF && !bF) return { first: a, last: b, order: "fl" };
  if (bF && !aF) return { first: b, last: a, order: "lf" };
  // Оба слова неизвестны словарю: решаем по форме фамилии.
  const aS = SUR_SHAPE.test(a), bS = SUR_SHAPE.test(b);
  if (bS && !aS) return { first: a, last: b, order: "fl" };
  if (aS && !bS) return { first: b, last: a, order: "lf" };
  return { first: a, last: b, order: "fl" };
}

/**
 * Пол определяется по фамилии, а если фамилия несклоняемая (Лысенко, Элчи) - по
 * имени. Псевдоним обязан совпадать по полу: переименовать сотрудницу в мужчину
 * внутри документа о её собственной работе недопустимо.
 */
export function genderOf(fullName) {
  const { first, last } = splitName(fullName);
  if (FEM_SUR.test(last)) return "f";
  if (MAL_SUR.test(last)) return "m";
  if (MALE_EXC.test(low(first))) return "m";
  if (/[ая]$/u.test(first)) return "f";
  return "m";
}

/** Стабильный ключ имени: устойчив к порядку слов и к ё. */
export function nameKey(s) {
  const t = low(s);
  return [...new Set(t.split(/[^а-яa-z-]+/).filter((w) => w.length > 1))].sort().join(" ");
}

// ─────────────────────────────────────────── падежи

/**
 * Падежные формы фамилии в фиксированном порядке. Реальная фамилия и псевдоним
 * дают списки одинаковой длины, замена идёт форма в форму: «у Лакомовой» должно
 * стать «у Соколовой», а не «у Соколова».
 */
function surnameForms(s) {
  let m;
  if ((m = s.match(/^(.+?)(ова|ева|ёва|ина|ына)$/u))) {
    const base = m[1] + m[2].slice(0, -1);          // Маслов, Ерин
    return [s, base + "ой", base + "у", base + "ою", base + "ы"];
  }
  if ((m = s.match(/^(.+?)(ская|цкая|ая)$/u))) {
    const base = m[1] + m[2].slice(0, -2);          // Яров
    return [s, base + "ой", base + "ую", base + "ою", base + "ой"];
  }
  if ((m = s.match(/^(.+?)(ов|ев|ёв|ин|ын)$/u))) {
    return [s, s + "а", s + "у", s + "ым", s + "е"];
  }
  if ((m = s.match(/^(.+?)(ский|цкий)$/u))) {
    const base = m[1] + m[2].slice(0, -2);
    return [s, base + "ого", base + "ому", base + "им", base + "ом"];
  }
  return [s, s, s, s, s];                            // Лысенко, Элчи, Шура-Бура
}

/** Формы личного имени. В нашем корпусе имя стоит в обращении, то есть в им. падеже. */
function firstForms(s) {
  let m;
  if ((m = s.match(/^(.+)а$/u))) {
    const b = m[1];
    const gen = /[гкхжчшщ]$/u.test(b) ? b + "и" : b + "ы";
    return [s, gen, b + "е", b + "у", b + "ой"];
  }
  if ((m = s.match(/^(.+)я$/u))) {
    const b = m[1];
    return [s, b + "и", b + "е", b + "ю", b + "ей"];
  }
  return [s, s + "а", s + "у", s + "а", s + "ом"];
}

// ─────────────────────────────────────────── таблица соответствия

/** Строит или дополняет таблицу соответствия. Существующие пары не трогает. */
export function buildMap(names, existing = {}) {
  const map = { ...existing };
  const used = new Set(Object.values(map).map((v) => v.alias));
  const skipped = [];
  // Псевдоним не должен переиспользовать слово из настоящего ростера. Иначе
  // «Алина Соколова» как псевдоним Ериной сталкивается с настоящей Алиной
  // Платоновой: читатель связывает двух разных людей одним именем, а контроль
  // утечки не может отличить псевдоним от остатка.
  const banned = new Set();
  for (const n of names) {
    const s = splitName(n);
    if (s.first) banned.add(low(s.first));
    if (s.last) banned.add(low(s.last));
  }
  const free = (alias) => alias.split(" ").every((w) => !banned.has(low(w)));
  const idx = { f: 0, m: 0 };
  for (const raw of names) {
    if (NOT_A_PERSON.test(raw)) { skipped.push(norm(raw)); continue; }
    const key = nameKey(raw);
    if (!key || map[key]) continue;
    const { first, last } = splitName(raw);
    if (!last) { skipped.push(norm(raw)); continue; }
    const g = genderOf(raw);
    const pool = POOL[g];
    while (idx[g] < pool.length && (used.has(pool[idx[g]]) || !free(pool[idx[g]]))) idx[g]++;
    if (idx[g] >= pool.length) throw new Error(`Пул псевдонимов (${g}) исчерпан, дополните списки имён`);
    const alias = pool[idx[g]];
    const [aliasFirst, aliasLast] = alias.split(" ");
    map[key] = { real: norm(raw), first, last, alias, aliasFirst, aliasLast, g };
    used.add(alias);
    idx[g]++;
  }
  return { map, skipped };
}

// ─────────────────────────────────────────── замена

// Буква ё в выгрузках пишется через раз: «менеджер Алена» в исходящем сообщении и
// «Алёна Кубанова» в карточке это один человек. Шаблон делает их взаимозаменяемыми,
// иначе написание без ё проходит мимо замены и остаётся в файле настоящим именем.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  .replace(/[еёЕЁ]/g, (c) => (c === c.toUpperCase() ? "[ЕЁ]" : "[её]"));
// Границы слова по кириллице: \b в JS считает кириллицу «словом» непоследовательно.
const rx = (body, flags = "gu") => new RegExp(`(?<![А-Яа-яЁёA-Za-z])${body}(?![А-Яа-яЁёA-Za-z])`, flags);

/**
 * Замена в тексте, три слоя по убыванию надёжности.
 *  1. Полное имя в обоих порядках слов. Однозначно.
 *  2. Одиночная фамилия во всех падежах. Однозначно: клиентов по фамилии в этом
 *     корпусе не зовут, обращение всегда по имени.
 *  3. Одиночное личное имя - ТОЛЬКО имя владельца страницы (opts.owner). Голое
 *     «Ольга» в цитате чаще всего клиент, а не сотрудник: «Анастасия, добрый день»
 *     в исходящем это обращение менеджера к клиентке. Заменять такие вслепую
 *     значит выдавать клиента за сотрудника и ломать атрибуцию реплик.
 */
export function apply(text, map, opts = {}) {
  const pairs = [];
  for (const p of Object.values(map)) {
    const rf = surnameForms(p.last), af = surnameForms(p.aliasLast);
    // Слой 1: полное имя. Порядок слов псевдонима повторяет порядок в источнике.
    pairs.push([`${p.first} ${p.last}`, `${p.aliasFirst} ${p.aliasLast}`]);
    pairs.push([`${p.last} ${p.first}`, `${p.aliasLast} ${p.aliasFirst}`]);
    pairs.push([`${p.last}, ${p.first}`, `${p.aliasLast}, ${p.aliasFirst}`]);
    // Слой 2: фамилия отдельно, форма в форму.
    for (let i = 0; i < rf.length; i++) if (rf[i] !== p.last || i === 0) pairs.push([rf[i], af[i]]);
  }
  // Слой 3: имя владельца страницы.
  if (opts.owner) {
    const p = map[nameKey(opts.owner)];
    if (!p) throw new Error(`Владелец «${opts.owner}» отсутствует в таблице соответствия`);
    const rf = firstForms(p.first), af = firstForms(p.aliasFirst);
    for (let i = 0; i < rf.length; i++) pairs.push([rf[i], af[i]]);
  }
  // Длинные формы первыми, иначе одиночная фамилия съест полное имя.
  pairs.sort((x, y) => y[0].length - x[0].length);

  let out = text;
  for (const [from, to] of pairs) out = out.replace(rx(esc(from)), to);
  // В режиме --scoped маскировка откладывается: сначала имя владельца заменяется
  // внутри записи менеджера, и только потом маскируется то, что не разобралось.
  return opts.deferMask ? out : maskIntros(out, map);
}

// Представление менеджера: «Меня зовут Ольга», «Ваш менеджер Татьяна». Здесь имя
// принадлежит сотруднику по построению фразы, а не клиенту.
const INTRO = /((?:меня\s+зовут|ваш(?:а)?\s+менеджер|менеджер)[\s,]+)([А-ЯЁ][а-яё]+)/giu;

/**
 * Слой 4. Имя в самопредставлении заменить псевдонимом нельзя: в исходящем письме
 * по чужой сделке пишет не всегда владелец страницы, а из текста отправитель не
 * восстанавливается. Ставим маркер вместо того, чтобы приписать реплику не тому
 * человеку. Псевдонимы, уже подставленные слоями 1-3, не трогаем.
 */
export function maskIntros(text, map) {
  const real = new Set(Object.values(map).map((p) => low(p.first)));
  return text.replace(INTRO, (m, pre, name) => (real.has(low(name)) ? `${pre}[менеджер]` : m));
}

/**
 * Контроль: настоящих полных имён и фамилий в результате быть не должно.
 * Одиночные личные имена считаются отдельно и не валят сборку - см. слой 3.
 */
export function check(text, map) {
  const hard = [], soft = [];
  for (const p of Object.values(map)) {
    for (const f of [`${p.first} ${p.last}`, `${p.last} ${p.first}`, ...surnameForms(p.last)]) {
      const n = (text.match(rx(esc(f))) || []).length;
      if (n) hard.push(`${f} (${n})`);
    }
    const n = (text.match(rx(esc(p.first))) || []).length;
    if (n) soft.push(`${p.first} (${n})`);
  }
  // Имя в самопредставлении принадлежит сотруднику, это жёсткая утечка.
  const real = new Set(Object.values(map).map((p) => low(p.first)));
  for (const m of text.matchAll(INTRO)) {
    if (real.has(low(m[2]))) hard.push(`самопредставление: ${m[0].replace(/\s+/g, " ")}`);
  }
  return { hard: [...new Set(hard)], soft: [...new Set(soft)] };
}

// ─────────────────────────────────────────────────────────── CLI
const [cmd, ...rest] = process.argv.slice(2);
const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
const flag = (n) => rest.includes(n);
const positional = () => {
  const skip = new Set();
  for (const n of ["--map", "--owner", "--roster", "--out"]) {
    const i = rest.indexOf(n);
    if (i >= 0) { skip.add(i); skip.add(i + 1); }
  }
  return rest.find((a, i) => !skip.has(i) && !a.startsWith("--"));
};

if (cmd === "map") {
  const rosterPath = opt("--roster"), outPath = opt("--out");
  if (!rosterPath || !outPath) {
    console.error("Использование: node pseudonymize.mjs map --roster roster.json --out таблица.json");
    process.exit(1);
  }
  const names = JSON.parse(readFileSync(rosterPath, "utf8"));
  const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
  const { map, skipped } = buildMap(names, existing);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(map, null, 1));
  console.error(`таблица соответствия: ${Object.keys(map).length} человек -> ${outPath}`);
  if (skipped.length) console.error(`не человек, оставлено как есть: ${[...new Set(skipped)].join(", ")}`);
  console.error("Файл содержит связку настоящее имя / псевдоним. Только Ивану, в git не класть.");
  for (const p of Object.values(map)) console.log(`${p.real}\t${p.alias}\t${p.g}`);

} else if (cmd === "apply") {
  const file = positional(), mapPath = opt("--map");
  if (!file || !mapPath) {
    console.error('Использование: node pseudonymize.mjs apply файл --map таблица.json [--owner "Фамилия Имя"] [--scoped] > out');
    process.exit(1);
  }
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  let out = apply(readFileSync(file, "utf8"), map, { owner: opt("--owner"), deferMask: flag("--scoped") });

  // Сводка штаба держит данные всех менеджеров в одном объекте, поэтому владельца
  // страницы у неё нет. Личное имя заменяем внутри записи конкретного менеджера:
  // там оно однозначно, снаружи записи - нет.
  if (flag("--scoped")) {
    const m = out.match(/^const D = (\{[\s\S]*?\});$/m);
    if (!m) { console.error("--scoped: не нашёл строку «const D = ...;»"); process.exit(1); }
    const D = JSON.parse(m[1]);
    const byAlias = {};
    for (const p of Object.values(map)) byAlias[nameKey(p.alias)] = p;
    let touched = 0;
    // managers это список записей с полем mgr, kostyaManagers - объект по имени.
    const records = [];
    for (const key of ["managers", "kostyaManagers", "dealsByMgr", "flagsByMgr"]) {
      const v = D[key];
      if (Array.isArray(v)) for (const rec of v) records.push([rec.mgr || rec.name || "", rec]);
      else if (v && typeof v === "object") for (const [k, rec] of Object.entries(v)) records.push([k, rec]);
    }
    for (const [who, rec] of records) {
      const p = byAlias[nameKey(who)];
      if (!p || !rec || typeof rec !== "object") continue;
      const rf = firstForms(p.first), af = firstForms(p.aliasFirst);
      let s = JSON.stringify(rec);
      for (let i = 0; i < rf.length; i++) s = s.replace(rx(esc(rf[i])), af[i]);
      const fixed = JSON.parse(s);
      if (Array.isArray(rec)) rec.splice(0, rec.length, ...fixed);
      else Object.assign(rec, fixed);
      touched++;
    }
    out = out.replace(m[0], `const D = ${JSON.stringify(D)};`);
    out = maskIntros(out, map);
    console.error(`--scoped: имя владельца заменено внутри ${touched} записей`);
  }

  const { hard, soft } = check(out, map);
  if (hard.length) {
    console.error(`ОСТАЛИСЬ НАСТОЯЩИЕ ИМЕНА: ${hard.slice(0, 8).join(", ")}`);
    process.exit(1);
  }
  if (soft.length) console.error(`личные имена без фамилии, не тронуты (могут быть клиентами): ${soft.join(", ")}`);
  process.stdout.write(out);

} else if (cmd === "check") {
  const file = positional(), mapPath = opt("--map");
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  const { hard, soft } = check(readFileSync(file, "utf8"), map);
  console.log(`${file}: полные имена и фамилии ${hard.length ? hard.join(", ") : "нет"}`);
  console.log(`${file}: одиночные имена ${soft.length ? soft.join(", ") : "нет"}`);
  process.exit(hard.length ? 1 : 0);

} else {
  console.error("Команды: map, apply, check");
  process.exit(1);
}
