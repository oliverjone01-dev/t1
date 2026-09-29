// ФЕНИКС iter3: ячейки таблиц с двумя и более разными числами под одним ключом (мультимножество в numsnap 2.0)
const fs = require('fs');
const f = process.argv[2];
const S = JSON.parse(fs.readFileSync(f, 'utf8'));
let cells = 0, multi = 0; const ex = {}; const byCol = {};
for (const [sid, s] of Object.entries(S.states)) {
  if (sid.includes('@390')) continue;
  for (const [k, t] of Object.entries(s.keys)) {
    if (s.kinds[k] !== 'cell') continue;
    cells++;
    if (new Set(t).size >= 2) {
      multi++;
      const col = k.replace(/^.* \| /, '');
      byCol[col] = (byCol[col] || 0) + 1;
      const kk = k.replace(/^.*» /, '');
      if (Object.keys(ex).length < 14 && !ex[col]) ex[col] = sid + ' :: ' + kk.slice(0, 80) + ' :: ' + JSON.stringify(t).slice(0, 70);
    }
  }
}
console.log('ключей-ячеек (1280):', cells, '| с двумя и более разными числами:', multi);
console.log('по столбцам:', JSON.stringify(Object.entries(byCol).sort((a, b) => b[1] - a[1]).slice(0, 12)));
for (const v of Object.values(ex)) console.log('  ', v);
console.log('meta.mode', JSON.stringify(S.meta.mode), '| состояний', Object.keys(S.states).length);
