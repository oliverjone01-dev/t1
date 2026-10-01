#!/usr/bin/env node
// Стенд остатка на счёте: сеть подменена, живой Директ не трогается.
// Заглушка врёт ТАК ЖЕ, как врёт настоящий API (суммы строками, AccountDayBudget
// вложенным объектом, отказы в ActionsResult) - иначе стенд подтверждает не то,
// что потом приходит по сети.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAccount, parseMoney, fundingModes } from '../dashboard/lib-account.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let bad = 0;
const ok = (name, cond) => { console.log((cond ? 'ok      ' : 'ПРОВАЛ  ') + name); if (!cond) bad++; };
const live = data => async () => data;
const boom = msg => async () => { throw new Error(msg); };

// Ровно та форма, что пришла живой пробой 30.09.2026.
const REAL = { data: { ActionsResult: [], Accounts: [{
  AccountID: 701081001, AccountDayBudget: { Amount: '5000' },
  Amount: '52655.11', AmountAvailableForTransfer: '53138.15', AgencyName: 'eLama.ru',
  EmailNotification: { PausedByDayBudget: 'Yes', MoneyWarningValue: 20 },
  Login: 'x', Currency: 'RUB' }] } };

const a = await readAccount(live(REAL.data));
ok('живая форма разобралась', a.ok === true);
ok('  остаток числом, не строкой', a.balance === 52655.11);
ok('  доступное к возврату отдельным полем', a.available_for_transfer === 53138.15);
ok('  остаток и возврат НЕ перепутаны', a.balance < a.available_for_transfer);
ok('  дневной бюджет из вложенного объекта', a.day_budget === 5000);
ok('  порог предупреждения', a.warning_at === 20);
ok('  агентство видно (пополнение идёт через него)', a.agency === 'eLama.ru');
ok('  валюта зафиксирована', a.currency === 'RUB');

// Пропуск не должен становиться нулём - это главный смысл стенда.
const noAmount = { Accounts: [{ ...REAL.data.Accounts[0], Amount: undefined }] };
const b = await readAccount(live(noAmount));
ok('нет Amount: не ok и остаток null, а НЕ 0', b.ok === false && b.balance === null);
const emptyAmount = { Accounts: [{ ...REAL.data.Accounts[0], Amount: '' }] };
const c = await readAccount(live(emptyAmount));
ok('пустая строка: остаток null, а НЕ 0', c.ok === false && c.balance === null);
const junk = { Accounts: [{ ...REAL.data.Accounts[0], Amount: 'нет данных' }] };
ok('мусор вместо суммы: null', (await readAccount(live(junk))).balance === null);

// А настоящий ноль - это факт, и он должен проходить.
const zero = { Accounts: [{ ...REAL.data.Accounts[0], Amount: '0' }] };
const z = await readAccount(live(zero));
ok('остаток РОВНО 0 - это факт, не пропуск', z.ok === true && z.balance === 0);

// Формат с пробелом и запятой.
ok('«52 655,11» разбирается', parseMoney('52 655,11') === 52655.11);

// Валюта.
const usd = { Accounts: [{ ...REAL.data.Accounts[0], Currency: 'USD' }] };
const u = await readAccount(live(usd));
ok('не RUB: не ok, валюта названа', u.ok === false && /USD/.test(u.error));

// Общий счёт не подключён - реальный отказ 515 из пробы с Logins.
const f515 = { Accounts: [], ActionsResult: [{ AccountID: null, Login: 'x',
  Errors: [{ FaultCode: 515, FaultString: 'Требуется подключить общий счёт.' }] }] };
const f = await readAccount(live(f515));
ok('счетов нет: не ok', f.ok === false);
ok('  код отказа 515 сохранён, а не потерян', (f.faults || []).some(x => /515/.test(x)));

// Два счёта молча складывать нельзя.
const two = { Accounts: [REAL.data.Accounts[0], REAL.data.Accounts[0]] };
const t = await readAccount(live(two));
ok('два счёта: не ok и НЕ сумма', t.ok === false && t.balance === undefined);

// Отказ сети не должен ни падать, ни давать ноль.
const e = await readAccount(boom('live/AccountManagement: HTTP 502'));
ok('отказ сети: не бросил, не ok', e.ok === false);
ok('  остатка нет вовсе, а не 0', e.balance === undefined);

// Режим финансирования: остаток общего счёта описывает всё только пока все там.
const shared = n => Array.from({ length: n },
  () => ({ Funds: { Mode: 'SHARED_ACCOUNT_FUNDS', SharedAccountFunds: { Refund: 0, Spend: 0 } } }));
ok('все 35 на общем счёте (как в живой пробе)', fundingModes(shared(35)).all_shared === true);
const mixed = [...shared(34), { Funds: { Mode: 'CAMPAIGN_FUNDS', CampaignFunds: { Balance: '100' } } }];
const fm = fundingModes(mixed);
ok('одна кампания на своих средствах: all_shared сброшен', fm.all_shared === false);
ok('  оба режима посчитаны', fm.modes.SHARED_ACCOUNT_FUNDS === 34 && fm.modes.CAMPAIGN_FUNDS === 1);
ok('поля Funds нет вовсе: НЕ выдаём за общий счёт',
  fundingModes([{ Id: 1 }]).all_shared === false);
ok('пусто: тоже не общий счёт', fundingModes([]).all_shared === false);

// Токен не должен попадать в текст ошибки: тело запроса Live v4 содержит его.
const src = ['make-snapshots.mjs', 'lib-account.mjs']
  .map(f => readFileSync(join(HERE, '..', 'dashboard', f), 'utf8')).join('\n');
const errLines = src.split('\n').filter(l => /new Error\(/.test(l));
ok('ни одна Error не тащит тело запроса или токен',
  errLines.length > 0 && !errLines.some(l => /DTOKEN|\bbody\b/.test(l)));
ok('текст ответа тоже не уходит в Error', !errLines.some(l => /\$\{text\}/.test(l)));

console.log(bad ? `\nПРОВАЛОВ: ${bad}` : '\nвсе проверки прошли');
process.exit(bad ? 1 : 0);
