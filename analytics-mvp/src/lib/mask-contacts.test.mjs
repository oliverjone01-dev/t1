import { maskText } from './mask-contacts.mjs';
const cases = [
  // должно закрыться
  ['С уважением, Ольга89652705125', 'Ольга', '****'],
  ['Марина Аврамова89003014585', 'Аврамова', '****'],
  ['Тел: +7 (925) 342-20-53', '+7925', '****'],
  ['номер 7 (925)\r\n342-20-53 конец', '', '****'],
  ['почта nick_dw@mail.ru', 'ni****@mail.ru', ''],
  ['карта 5469 4000 3022 4138', '****4138', ''],
  // НЕ должно трогать
  ['сумма 90 000 - 95 000 рублей', '90 000 - 95 000', null],
  ['сделка 101069 от 24.09.2026', '101069', null],
  ['трек 12345678901234', '12345678901234', null],
  ['размер 2400 х 1200 х 8', '2400 х 1200 х 8', null],
  ['артикул GGT-35-1-3', 'GGT-35-1-3', null],
  ['ссылка https://go.2gis.com/abcd12345678901', 'abcd12345678901', null],
];
let bad=0;
for (const [inp, expect, must] of cases) {
  const out = maskText(inp);
  const ok = must === null ? out.includes(expect) && !out.includes('****')
           : out.includes(expect) && (must === '' || out.includes(must));
  if (!ok) { bad++; console.log('ПРОВАЛ:', JSON.stringify(inp), '->', JSON.stringify(out)); }
}
console.log(bad ? `провалов: ${bad}` : `все ${cases.length} проверок прошли`);
