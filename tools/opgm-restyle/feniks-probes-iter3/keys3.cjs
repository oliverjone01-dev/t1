// ФЕНИКС iter3: несут ли «ключи без значений» данные клиентов и менеджеров (план §3.7: в отчёты идут «ключи без значений»)
// Синтетика: имена фикстуры и шаблоны сообщений клиентов из harness/fixture.js.
const fs = require('fs');
const S = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const NAMES = ['Тестовый', 'Образец', 'Пример', 'Демо', 'Проба', 'Макет', 'Шаблон', 'Эскиз'];
const MSG = ['сколько стоит', 'Какие размеры', 'Можно с фото', 'подумаем', 'Когда будет готово', 'Уточните'];
let keys = 0, withName = 0, withMsg = 0; const ex = { name:[], msg:[] };
const states = Object.keys(S.states), mgrStates = states.filter(s => s.startsWith('менеджер '));
for (const [sid, s] of Object.entries(S.states)) for (const k of Object.keys(s.keys)) {
  keys++;
  if (NAMES.some(n => k.includes(n))) { withName++; if (ex.name.length < 3) ex.name.push(sid + ' :: ' + k.slice(0, 110)); }
  if (MSG.some(m => k.includes(m))) { withMsg++; if (ex.msg.length < 2) ex.msg.push(sid + ' :: ' + k.slice(0, 140)); }
}
console.log('ключей всего', keys, '| с именем клиента или менеджера', withName, '| с текстом сообщения клиента', withMsg);
console.log('состояний с именем менеджера в id:', mgrStates.length, mgrStates.slice(0, 2).join('; '));
ex.name.forEach(x => console.log('  имя:', x)); ex.msg.forEach(x => console.log('  текст:', x));
