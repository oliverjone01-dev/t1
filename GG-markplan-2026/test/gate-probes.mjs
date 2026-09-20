// Стенд на сам гейт утверждений. Каждый приём здесь кто-то уже применял:
// семь проб ФЕНИКСА итерации 4, пять проб итерации 5 и две дыры, найденные
// при доводке. Проба, которой нет в этом файле, считается непроверенной.
import { findClaims, recordedScores, excuse, RENDERED, CLAIM_RE, maskDates, OWN_UNIT, MEASURE } from './claims-gate.mjs';

let fails = 0, checks = 0;
const rec = recordedScores();

// ловится ли утверждение в произвольном тексте
function caught(txt, file = 'plan.html') {
  return findClaims(txt, file).some(h => !excuse(file, h.value, h.ctxWin) && !rec.set.has(h.value));
}
// правило для полей вердикта: число в шкале обязано нести меру
function verdictOk(txt) {
  const masked = maskDates(String(txt))
    .replace(new RegExp(CLAIM_RE.source, 'g'), m => ' '.repeat(m.length))
    .replace(/\bB7\b|\bZ\d+\b/g, m => ' '.repeat(m.length));
  for (const m of masked.matchAll(/\b(\d{1,2}(?:[.,]\d{1,2})?)\b/g)) {
    const n = Number(String(m[1]).replace(',', '.'));
    if (!(n >= 0 && n <= 10)) continue;
    if (OWN_UNIT.test(masked.slice(m.index + m[0].length, m.index + m[0].length + 26))) continue;
    return false;
  }
  return true;
}
function probe(name, got, want) {
  checks++;
  if (got !== want) { fails++; console.log(`  FAIL ${name}: получено ${got}, ждали ${want}`); }
}

console.log('— формы, которые гейт обязан ловить —');
probe('дробное с мерой',            caught('Страница прошла аудит с оценкой 9,9 из 10.'), true);
probe('запятая сразу после меры',   caught('Оценка 9,9 из 10, вердикт принято.'), true);
probe('слэш вместо «из»',           caught('Оценка страницы 9,2/10.'), true);
probe('разметка внутри числа',      caught('Оценка аудита <b>9,2</b>/10, принято.'), true);
probe('разметка внутри меры',       caught('Оценка аудита 9,4 из <i>10</i>, принято.'), true);
probe('неразрывный пробел',         caught('Оценка 9,1 из 10.'), true);
probe('сущность пробела &#32;',     caught('Оценка 9,5&#32;из&#32;10.'), true);
probe('тонкий пробел &thinsp;',     caught('Оценка 9,6&thinsp;из&thinsp;10.'), true);
probe('перенос строки перед мерой', caught('Оценка страницы 9,3\n        из 10.'), true);
probe('мера «балла»',               caught('Аудит поставил 9,7 балла.'), true);
probe('мера «по десятибалльной»',   caught('Аудит: 9,8 по десятибалльной шкале.'), true);
probe('целое рядом со словом',      caught('Оценка страницы 8 из 10.'), true);
probe('целое, «ФЕНИКС дал»',        caught('ФЕНИКС дал 8 из 10.'), true);
probe('целое, «набрала»',           caught('Страница набрала 9 из 10.'), true);

console.log('— что гейт обязан пропускать —');
probe('обычная речь: люди',         caught('Держать в команде хотя бы 8 из 10 человек.'), false);
probe('подтверждённая оценка',      caught('Последняя проверка: 8,8 из 10.'), false);

console.log('— поля вердикта: форма без меры запрещена —');
probe('без меры запрещено',   verdictOk('Оценка страницы по внутреннему аудиту: 9,9.'), false);
probe('с мерой разрешено',    verdictOk('Оценка страницы по внутреннему аудиту: 9,9 из 10.'), true);
probe('своя единица не мешает', verdictOk('Расхождение в 16 раз, проверок было 5 штук.'), true);

console.log('— освобождение страницы-отчёта —');
probe('разбор про разговор',  caught('Общая оценка разговора 6,6 из 10.', 'razbor.html'), true);
// ключ REPORT_PAGES это относительный путь, поэтому произвольный файл с тем же
// именем освобождения не получает; а утверждение про план не освобождается и
// на самой странице разбора - это проверяет checkClaims, см. notAbout.

console.log('— признанный пробел, он же документирован в README —');
probe('целое без слова про оценку', caught('Итого 7 из 10, решение принято.'), true);
probe('бесконтекстное целое',       caught('Получилось 7 из 10.'), false);

console.log(`\nгейт-пробы: ${checks + 0} проверок, провалов ${fails}`);
process.exit(fails ? 1 : 0);
