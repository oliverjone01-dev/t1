#!/usr/bin/env node
// gen-demo.mjs - генерирует DEMO-снапшоты той же схемы, что живой harvest.
// Детерминированно (seeded PRNG), без сети. Запуск: node scripts/gen-demo.mjs
// Пишет в public/demo/<project>/*.json. Цифры правдоподобные, помечены demo:true.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "demo");

// seeded PRNG (mulberry32) - воспроизводимые "случайные" ряды
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// демо-даты: фиксированное "сегодня" снапшота, чтобы сборка была воспроизводимой
const TODAY = new Date("2026-07-09T03:00:00Z");
const day = (offset) => { const d = new Date(TODAY); d.setUTCDate(d.getUTCDate() - offset); return d.toISOString().slice(0, 10); };

function series(n, base, drift, noise, r, dipAt = -1, dipK = 1) {
  const out = [];
  let v = base;
  for (let i = n - 1; i >= 0; i--) {
    v = v * (1 + drift) + (r() - 0.5) * noise * base;
    let val = Math.max(1, Math.round(v));
    if (dipAt >= 0 && i <= dipAt && i > dipAt - 7) val = Math.round(val * dipK); // недельная просадка для сигнала
    out.push({ date: day(i), value: val });
  }
  return out;
}

const PROJECTS = {
  genglass: {
    seed: 42, visibility: 14260, kw_total: 2431, top1: 38, top3: 112, top10: 314, top50: 1207,
    visitsBase: 620, searchShare: 0.56, dip: false,
    spend: 186340, clicks: 1452, impressions: 18630, cpc: 128.3,
    phrases: [
      ["стеклянные перегородки", 4, 74000, "/peregorodki/", "перегородки", "commercial"],
      ["стеклянные перегородки для квартиры", 7, 12400, "/peregorodki/kvartira/", "перегородки", "commercial"],
      ["перегородка кухня гостиная", 12, 9800, "/peregorodki/kuhnya-gostinaya/", "перегородки", "commercial"],
      ["раздвижные стеклянные перегородки", 9, 8100, "/peregorodki/razdvizhnye/", "перегородки", "commercial"],
      ["перегородки в стиле лофт", 6, 6400, "/peregorodki/loft/", "перегородки", "commercial"],
      ["стеклянная перегородка цена", 14, 5900, "/peregorodki/#price", "перегородки", "transactional"],
      ["зонирование комнаты перегородкой", 11, 4300, "/blog/zonirovanie/", "перегородки", "informational"],
      ["перегородка в студию", 17, 3100, "/peregorodki/studiya/", "перегородки", "commercial"],
      ["зеркало в металлической раме", 3, 18700, "/zerkala/v-rame/", "зеркала", "commercial"],
      ["зеркало в раме лофт", 5, 7600, "/zerkala/loft/", "зеркала", "commercial"],
      ["зеркала с подсветкой", 8, 15200, "/zerkala/s-podsvetkoy/", "зеркала", "commercial"],
      ["зеркало с подсветкой в ванную", 13, 9100, "/zerkala/vannaya/", "зеркала", "commercial"],
      ["большое зеркало в пол", 10, 11800, "/zerkala/napolnye/", "зеркала", "commercial"],
      ["зеркало в спальню над комодом", 21, 2600, "/zerkala/spalnya/", "зеркала", "informational"],
      ["туалетный столик с зеркалом", 15, 22400, "/stoly/tualetnyj/", "столы", "commercial"],
      ["туалетный столик лофт", 18, 4700, "/stoly/tualetnyj-loft/", "столы", "commercial"],
      ["консольный стол металл", 16, 3900, "/stoly/konsolnye/", "столы", "commercial"],
      ["журнальный столик стекло металл", 12, 6800, "/stoly/zhurnalnye/", "столы", "commercial"],
      ["мебель лофт на заказ", 19, 8900, "/loft/", "лофт", "commercial"],
      ["мебель из металла и стекла", 9, 5200, "/", "лофт", "commercial"],
      ["стеллаж лофт металлический", 23, 7400, "/stellazhi/", "лофт", "commercial"],
      ["как выбрать стеклянную перегородку", 5, 1900, "/blog/kak-vybrat-peregorodku/", "перегородки", "informational"],
      ["перегородка вместо стены", 8, 2800, "/blog/peregorodka-vmesto-steny/", "перегородки", "informational"],
      ["сколько стоит перегородка из стекла", 24, 2100, "/blog/skolko-stoit/", "перегородки", "transactional"],
      ["душевая перегородка из стекла", 27, 13600, "/dushevye/", "душевые", "commercial"],
      ["шторка для душа стеклянная", 31, 9700, "/dushevye/shtorki/", "душевые", "commercial"],
      ["экран для ванной стекло", 34, 4100, "/dushevye/ekrany/", "душевые", "commercial"],
      ["зеркальное панно на стену", 22, 5300, "/zerkala/panno/", "зеркала", "commercial"],
      ["перила из стекла", 41, 3800, "/perila/", "ограждения", "commercial"],
      ["стеклянные двери межкомнатные", 46, 16900, "/dveri/", "двери", "commercial"],
      ["зеркало гримерное с лампочками", 26, 6100, "/zerkala/grimernye/", "зеркала", "commercial"],
      ["полка стеклянная настенная", 37, 3300, "/polki/", "полки", "commercial"],
      ["изголовье кровати зеркальное", 29, 1700, "/spalnya/izgolovya/", "зеркала", "commercial"],
      ["перегородка для зонирования купить", 20, 3400, "/peregorodki/", "перегородки", "transactional"],
      ["лофт перегородки чёрные", 13, 2900, "/peregorodki/loft-black/", "перегородки", "commercial"],
      ["зеркало ростовое в раме", 11, 4800, "/zerkala/rostovye/", "зеркала", "commercial"]
    ],
    droppedTop10: [["стеклянная перегородка цена", 9, 14], ["журнальный столик стекло металл", 8, 12]],
    enteredTop10: [["зеркало в раме лофт", 12, 5]],
    competitorUp: [["miralls.ru", 8.4]],
    directQueries: [
      ["стеклянные перегородки москва", 214, 31240], ["зеркало с подсветкой купить", 187, 21360],
      ["перегородка лофт купить", 143, 19870], ["туалетный столик купить", 129, 14980],
      ["душевая перегородка цена", 118, 17240], ["зеркало в раме купить", 104, 11890],
      ["стеклянные двери на заказ", 92, 13470], ["мебель лофт москва", 88, 9640],
      ["перила стеклянные цена", 71, 8930], ["зеркальное панно купить", 63, 7210]
    ],
    competitors: [
      ["miralls.ru", 16890, 412, 8.4], ["archpole.ru", 12140, 287, 1.2], ["loffi.ru", 9860, 246, -2.1],
      ["loftdesigne.ru", 8420, 233, 0.6], ["amgrades.ru", 6110, 158, -0.8], ["moonzana.ru", 5730, 121, 3.9]
    ],
    goals: [["Заявка с сайта", 94], ["Звонок (коллтрекинг)", 141], ["Заказ замера", 57]]
  },
  "glass-memory": {
    seed: 77, visibility: 1840, kw_total: 186, top1: 6, top3: 14, top10: 37, top50: 112,
    visitsBase: 84, searchShare: 0.63, dip: true,
    spend: 32410, clicks: 409, impressions: 6120, cpc: 79.2,
    phrases: [
      ["стеклянный памятник", 3, 4400, "/pamyatniki/", "памятники", "commercial"],
      ["памятник из стекла на могилу", 5, 2100, "/pamyatniki/na-mogilu/", "памятники", "commercial"],
      ["портрет на стекле на памятник", 4, 3600, "/portrety/", "портреты", "commercial"],
      ["портрет в стекле фото", 9, 1800, "/portrety/#gallery", "портреты", "informational"],
      ["табличка на памятник стекло", 6, 2900, "/tablichki/", "таблички", "commercial"],
      ["ритуальные изделия из стекла", 2, 990, "/", "бренд", "commercial"],
      ["мемориал из стекла", 7, 640, "/memorialy/", "памятники", "commercial"],
      ["стеклянная плита на памятник", 12, 780, "/pamyatniki/plity/", "памятники", "commercial"],
      ["цветное стекло памятник", 15, 410, "/pamyatniki/tsvetnye/", "памятники", "commercial"],
      ["накладка на памятник из стекла", 8, 1300, "/nakladki/", "накладки", "commercial"],
      ["наборное стекло мемориал", 11, 350, "/nabornoe/", "накладки", "commercial"],
      ["сколько стоит стеклянный памятник", 13, 890, "/blog/skolko-stoit/", "памятники", "transactional"],
      ["стеклянный памятник отзывы", 18, 520, "/otzyvy/", "бренд", "informational"],
      ["памятник из стекла и гранита", 16, 470, "/pamyatniki/kombinirovannye/", "памятники", "commercial"],
      ["дилер ритуальных изделий", 21, 260, "/dileram/", "дилеры", "commercial"],
      ["что лучше гранит или стекло памятник", 10, 380, "/blog/granit-ili-steklo/", "памятники", "informational"],
      ["гравировка на стекле памятник", 24, 640, "/gravirovka/", "портреты", "commercial"],
      ["стеклянный крест на памятник", 27, 310, "/kresty/", "памятники", "commercial"]
    ],
    droppedTop10: [["накладка на памятник из стекла", 7, 11]],
    enteredTop10: [["что лучше гранит или стекло памятник", 14, 10]],
    competitorUp: [],
    directQueries: [
      ["стеклянный памятник купить", 96, 7830], ["портрет на стекле заказать", 84, 6110],
      ["табличка на памятник цена", 67, 4890], ["памятник на могилу необычный", 52, 4260],
      ["ритуальные изделия оптом", 41, 3370]
    ],
    competitors: [["gran-tech.ru", 3210, 44, 1.1], ["vpk-stone.ru", 2760, 38, -0.4]],
    goals: [["Заявка дилера", 12], ["Запрос каталога", 31]]
  }
};

for (const [id, p] of Object.entries(PROJECTS)) {
  const r = rng(p.seed);
  const dir = join(OUT, id);
  mkdirSync(dir, { recursive: true });

  const hist = series(30, p.visibility * 0.92, 0.004, 0.02, r);
  const top10hist = series(30, p.top10 * 0.9, 0.005, 0.03, rng(p.seed + 1));
  const keysso = {
    demo: true, domain: p === PROJECTS.genglass ? "genglass.ru" : "glass-memory.ru",
    measured: day(0), visibility: p.visibility, keywords_total: p.kw_total,
    top1: p.top1, top3: p.top3, top10: p.top10, top50: p.top50,
    history: hist.map((h, i) => ({ date: h.date, visibility: h.value, top10: top10hist[i].value })),
    keywords: p.phrases.map(([phrase, pos, freq, url]) => ({ phrase, pos, freq, url })),
    competitors: p.competitors.map(([domain, visibility, common, delta]) => ({ domain, visibility, common_keywords: common, delta_visibility: delta })),
    deltas: {
      dropped_top10: p.droppedTop10.map(([phrase, from, to]) => ({ phrase, from, to })),
      entered_top10: p.enteredTop10.map(([phrase, from, to]) => ({ phrase, from, to })),
      competitor_up: p.competitorUp.map(([domain, delta]) => ({ domain, delta }))
    }
  };
  writeFileSync(join(dir, "keysso.json"), JSON.stringify(keysso, null, 1) + "\n");

  const rv = rng(p.seed + 2);
  const visits = series(30, p.visitsBase, 0.002, 0.16, rv, p.dip ? 6 : -1, 0.72);
  const metrika = {
    demo: true, counter: "DEMO", measured: day(0),
    visits_30d: visits.map((v) => ({ date: v.date, visits: v.value, search_visits: Math.round(v.value * p.searchShare * (0.9 + rv() * 0.2)) })),
    top_phrases: p.phrases.slice(0, 12).map(([phrase], i) => ({ phrase, visits: Math.max(3, Math.round(p.visitsBase * 0.5 / (i + 1.6))) })),
    top_pages: [...new Set(p.phrases.map((x) => x[3]))].slice(0, 10).map((url, i) => ({ url, visits: Math.max(5, Math.round(p.visitsBase * 4.2 / (i + 1.4))) })),
    goals: p.goals.map(([name, conversions]) => ({ name, conversions })),
    bounce_rate: p === PROJECTS.genglass ? 21.4 : 26.8, depth: p === PROJECTS.genglass ? 3.1 : 2.4
  };
  writeFileSync(join(dir, "metrika.json"), JSON.stringify(metrika, null, 1) + "\n");

  const direct = {
    demo: true, measured: day(0), spend_30d: p.spend, impressions: p.impressions, clicks: p.clicks,
    ctr: +(p.clicks / p.impressions * 100).toFixed(2), avg_cpc: p.cpc,
    campaigns: [
      { name: "Поиск | Основные категории", spend: Math.round(p.spend * 0.58), clicks: Math.round(p.clicks * 0.55), ctr: 8.9, cpc: +(p.cpc * 1.05).toFixed(1) },
      { name: "Поиск | Брендовая", spend: Math.round(p.spend * 0.12), clicks: Math.round(p.clicks * 0.2), ctr: 22.4, cpc: +(p.cpc * 0.6).toFixed(1) },
      { name: "РСЯ | Ретаргетинг", spend: Math.round(p.spend * 0.3), clicks: Math.round(p.clicks * 0.25), ctr: 1.1, cpc: +(p.cpc * 1.2).toFixed(1) }
    ],
    search_queries: p.directQueries.map(([query, clicks, cost]) => ({ query, clicks, cost }))
  };
  writeFileSync(join(dir, "direct.json"), JSON.stringify(direct, null, 1) + "\n");

  const semantics = {
    demo: true, measured: day(0),
    phrases: p.phrases.map(([phrase, pos, freq, url, cluster, intent]) => ({ phrase, pos, freq, url, cluster, intent }))
  };
  writeFileSync(join(dir, "semantics.json"), JSON.stringify(semantics, null, 1) + "\n");
}

writeFileSync(join(OUT, "meta.json"), JSON.stringify({
  demo: true, updated: day(0),
  sources: {
    keysso: { status: "demo", requests_used: 0, limit: 3000 },
    metrika: { status: "demo" },
    direct: { status: "demo" }
  },
  note: "DEMO-снапшоты. Живые данные появятся в data/ после запуска harvest с секретами (см. SETUP.md)."
}, null, 1) + "\n");

console.log("DEMO data written to", OUT);
