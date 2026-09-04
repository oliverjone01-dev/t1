// Единая точка параметризации сборки по платформе (Этап 2 мультиплатформы, атом 1 эпизода
// feniks-veto-uploaded-docs-20260610: колонка platform закладывается при первом не-OZON источнике).
//
//   PLATFORM  - "ozon" (default) | "ym" (Яндекс Маркет). Меняет только подписи в HTML.
//   DATA_DIR  - откуда читать снимки (default "data"; для Маркета "data-ym").
//   OUT_DIR   - куда писать страницы (default "public"; для Маркета "public/market").
//
// Без переменных окружения все функции возвращают ровно прежние пути ("data/x", "public/x"),
// поэтому OZON-сборка байт-в-байт не меняется (гейт Этапа 2: diff public/ до и после).

export const PLATFORM: string = process.env.PLATFORM || "ozon";
export const IS_OZON: boolean = PLATFORM === "ozon";
export const DATA_DIR: string = process.env.DATA_DIR || "data";
export const OUT_DIR: string = process.env.OUT_DIR || "public";
export const FIXTURES_DIR: string = process.env.FIXTURES_DIR || "fixtures";

export const dp = (file: string): string => `${DATA_DIR}/${file}`;
export const op = (file: string): string => `${OUT_DIR}/${file}`;
export const fp = (file: string): string => `${FIXTURES_DIR}/${file}`;

export const PLATFORM_LABEL: string = IS_OZON ? "OZON" : "Яндекс Маркет";
export const SYNC_WORKFLOW: string = IS_OZON ? "ozon-snapshots.yml" : "ym-snapshots.yml";

// Ссылки на карточку товара и кабинет продавца в клиентском JS (site.ts ENGINE). Для OZON - ровно
// прежние строки (байт-в-байт). Для Маркета ключ = артикул, поэтому карточка - поиск по артикулу
// на market.yandex.ru (рабочий URL-паттерн); ссылки в партнёрский кабинет по артикулу нет -> null,
// а не чужая площадка (ФЕНИКС G5).
export const PRODUCT_URL_JS: string = IS_OZON
  ? "s=>'https://www.ozon.ru/product/'+s"
  : "s=>'https://market.yandex.ru/search?text='+encodeURIComponent(s)";
export const CABINET_URL_JS: string = IS_OZON
  ? "s=>OFF[s]?'https://seller.ozon.ru/app/products?search='+encodeURIComponent(OFF[s]):null"
  : "s=>null";

// Словарь подписей источников для Маркета (ФЕНИКС G4): подписи живут внутри клиентских JS-строк
// шаблона Кати, поэтому меняются на готовом HTML, но ЯВНЫМ списком фраз, а не одной регуляркой.
// Реклама Маркета не подключена - все рекламные подписи честно говорят «нет источника».
// Полнота словаря охраняется гейтом в smoke (PLATFORM=ym): realFBS|Seller API|Performance|Premium|ozon.ru запрещены.
const YM_LABELS: Array<[RegExp, string]> = [
  [/источник: OZON Performance API \(прямой/g, "нет источника: реклама Маркета не подключена, нули (заглушка"],
  [/Источник: OZON Performance \(дневной ряд statistics\/daily или снимок\)\./g, "Источник: нет (реклама Маркета не подключена, нули)."],
  [/Источник: OZON Performance \(дневной ряд за период\)\./g, "Источник: нет (реклама Маркета не подключена, нули)."],
  [/Источник: OZON Performance\./g, "Источник: нет (реклама Маркета не подключена, нули)."],
  [/\(CPC\+CPO из Performance API\)/g, "(рекламный кабинет Маркета не подключён)"],
  [/Источник: Seller API product\/info\/prices\./g, "Источник: каталог Маркета (offers, campaignPrice)."],
  [/OZON Performance API/g, "рекламный кабинет Маркета (не подключён)"],
  // Живой факт: подписи вида «(OZON Performance)» и «выручка/заказы Performance» шли по общему
  // правилу OZON -> Яндекс Маркет и превращались в несуществующий «Яндекс Маркет Performance».
  // Правила ниже обязаны стоять ДО общей замены слова OZON.
  [/\(OZON Performance\)/g, "(реклама Маркета не подключена)"],
  [/OZON Performance/g, "реклама Маркета (не подключена)"],
  [/выручка\/заказы Performance/g, "выручка/заказы рекламы (нет источника)"],
  [/выручка\/заказ Performance/g, "выручка/заказ рекламы (нет источника)"],
  [/заказы Performance/g, "заказы рекламы (нет источника)"],
  [/Performance/g, "реклама (нет источника)"],
  [/realFBS\+сервис\+страхование/g, "прочие сборы"],
  [/realFBS\/сервис\/страхование/g, "прочие сборы"],
  [/realFBS \+ сервис \+ страховка/g, "Прочие сборы кабинета"],
  [/realFBS/g, "прочие сборы"],
  [/Подписки \(Stars\/Premium\/отзывы\)/g, "Подписки/продвижение"],
  [/Бейдж\/сеть\/отзывы\/Premium/g, "Подписки/продвижение"],
];

// Подписи в готовом HTML для не-OZON платформы. Для OZON - identity (байт-в-байт).
// Меняем только человекочитаемые метки; идентификаторы каналов ('ozon', .ch-ozon) не трогаем:
// шаблон Кати завязан на id 'ozon' как на «живой канал», для Маркета этот слот занимает Маркет.
// Слот «Яндекс Маркет (нет данных)» в селекторе каналов при этом становится слотом OZON.
export function platformize(html: string): string {
  if (IS_OZON) return html;
  const YM_OTHER = "@@GG_OTHER_MP@@";
  let out = html
    .replace(/\['ym','Яндекс Маркет',0\]/g, `['ym','${YM_OTHER}',0]`)
    .replace(/"id":"ym","name":"Яндекс Маркет","short":"Я\.Маркет"/g, `"id":"ym","name":"${YM_OTHER}","short":"${YM_OTHER}"`)
    .replace(/ozon-snapshots\.yml/g, "ym-snapshots.yml");
  for (const [re, to] of YM_LABELS) out = out.replace(re, to);
  out = out
    .replace(/OZON/g, "Яндекс Маркет")
    .replace(/Озон/g, "Я.Маркет")
    .replace(/Ozon/g, "Я.Маркет");
  out = out.replace(new RegExp(YM_OTHER, "g"), "OZON");
  return out;
}

// Запрещённые на страницах Маркета фразы (гейт полноты словаря выше; проверяется в smoke при PLATFORM=ym).
export const YM_FORBIDDEN = /realFBS|Seller API|Performance|Premium|ozon\.ru/;
