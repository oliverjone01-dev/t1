/* ФЕНИКС iter2: независимый пересчёт Д7 по данным фикстуры (без opgm.js): объединение, abandoned, phoneleft, оба флага.
   Правила выборки повторены по смыслу экрана (клиентский чат, кабинет, первое сообщение клиента в окне), код экрана не импортируется. */
const vm = require('vm'), fs = require('fs');
const FIX = process.argv[2], FX = JSON.parse(process.argv[3] || '{}');
const win = { __FX_OPTS: FX };
vm.runInNewContext(fs.readFileSync(FIX, 'utf8'), { window: win, Math, Date, JSON });
const D = win.__FX, R = D.av.recon;
const EXP = Math.max(...['OLD-G', 'NEW-B'].map(c => Math.floor(Date.parse(R[c].exported) / 1000)));
const DAY = 86400;
const client = c => c.kind !== 'cold' && c.kind !== 'vendor' && c.nc > 0;
for (const cab of ['OLD-G', 'NEW-B']) for (const days of [7, 30]) {
  const to = EXP + 1, from = to - days * DAY;
  const L = D.av.chats.filter(c => c.cab === cab && client(c) && c.t >= from && c.t < to);
  const ab = L.filter(c => c.p.includes('abandoned')).length, ph = L.filter(c => c.p.includes('phoneleft')).length;
  const both = L.filter(c => c.p.includes('abandoned') && c.p.includes('phoneleft')).length;
  const uni = L.filter(c => c.p.includes('abandoned') || c.p.includes('phoneleft')).length;
  const nr = L.filter(c => c.p.includes('noresp')).length;
  const nrab = L.filter(c => c.p.includes('noresp') && (c.p.includes('abandoned') || c.p.includes('phoneleft'))).length;
  console.log(cab + ' ' + days + ' дн | сумма флагов ' + (ab + ph) + ' | объединение ' + uni + ' | только abandoned ' + ab + ' | phoneleft ' + ph + ' | оба флага ' + both + ' | noresp ' + nr + ' | noresp вместе с abandoned/phoneleft ' + nrab);
}
