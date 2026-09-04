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

// Подписи в готовом HTML для не-OZON платформы. Для OZON - identity (байт-в-байт).
// Меняем только человекочитаемые метки; идентификаторы каналов ('ozon', .ch-ozon) и ссылки
// не трогаем: шаблон Кати завязан на id 'ozon' как на «живой канал», для Маркета этот слот
// занимает Маркет. Слот «Яндекс Маркет (нет данных)» в селекторе каналов при этом становится
// слотом OZON, чтобы список каналов остался честным.
export function platformize(html: string): string {
  if (IS_OZON) return html;
  const YM_OTHER = "@@GG_OTHER_MP@@";
  let out = html
    .replace(/\['ym','Яндекс Маркет',0\]/g, `['ym','${YM_OTHER}',0]`)
    .replace(/"id":"ym","name":"Яндекс Маркет","short":"Я\.Маркет"/g, `"id":"ym","name":"${YM_OTHER}","short":"${YM_OTHER}"`)
    .replace(/ozon-snapshots\.yml/g, "ym-snapshots.yml")
    .replace(/OZON Performance API/g, "рекламный кабинет Маркета")
    .replace(/OZON/g, "Яндекс Маркет")
    .replace(/Озон/g, "Я.Маркет")
    .replace(/Ozon/g, "Я.Маркет");
  out = out.replace(new RegExp(YM_OTHER, "g"), "OZON");
  return out;
}
