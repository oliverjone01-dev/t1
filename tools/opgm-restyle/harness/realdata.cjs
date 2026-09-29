/* Загрузчик реальных данных ОП ГМ для стенда (решение по ТЗ iter2 п.8, план v3 §3.6).
   Данные расшифровывает только сессия Д-пакета (у неё пароль). В инструмент приходит уже расшифрованный D:
   папка ВНЕ любого git-репозитория с одним из наборов:
     D.json                                   - весь расшифрованный объект D, как его отдаёт decryptData (shell.html:88-89);
     av.json + recon.json [+ D-rest.json]     - выход build_av.py / склейки Д-пакета; D-rest.json = остальные ключи D (metrics, meta, talks, MGRS, ORDER ...).
   D живёт только в памяти процесса и страницы (addInitScript -> window.__REAL_D), на диск не пишется.
   Любой выходной путь (снимок, стенд .harness.html) обязан лежать вне git-репозитория: иначе код 2 до запуска браузера.
   Числа реальных снимков - данные клиентов и менеджеров: не коммитить, не вставлять в планы и эпизоды. */
const fs = require('fs'), path = require('path');

function gitRootOf(p){
  let d = path.resolve(p);
  while(!fs.existsSync(d)) d = path.dirname(d);
  for(;;){ if(fs.existsSync(path.join(d, '.git'))) return d; const up = path.dirname(d); if(up === d) return null; d = up; }
}
function refuseInRepo(p, what){
  const r = gitRootOf(p);
  if(r){ const e = new Error('РЕАЛЬНЫЕ ДАННЫЕ: ' + what + ' ' + path.resolve(p) + ' внутри git-репозитория ' + r + '. Запись и чтение данных клиентов в репозитории запрещены: укажите папку вне репозитория (например scratchpad сессии Д-пакета).'); e.code = 2; throw e; }
}
function load(dir){
  refuseInRepo(dir, 'папка данных');
  const f = n => path.join(dir, n), rd = n => JSON.parse(fs.readFileSync(f(n), 'utf8'));
  let D;
  if(fs.existsSync(f('D.json'))) D = rd('D.json');
  else if(fs.existsSync(f('av.json')) && fs.existsSync(f('recon.json'))){
    D = fs.existsSync(f('D-rest.json')) ? rd('D-rest.json') : {};
    D.av = rd('av.json'); D.av.recon = rd('recon.json');
  } else { const e = new Error('РЕАЛЬНЫЕ ДАННЫЕ: в ' + dir + ' нет D.json и нет пары av.json + recon.json'); e.code = 2; throw e; }
  const need = ['av', 'metrics', 'meta', 'MGRS', 'ORDER'].filter(k => !(k in D));
  if(!D.av || !D.av.chats || !D.av.msgs || !D.av.recon) need.push('av.chats/av.msgs/av.recon');
  if(need.length){ const e = new Error('РЕАЛЬНЫЕ ДАННЫЕ: в D нет ключей ' + need.join(', ') + ' (экраны 24eb500d их читают)'); e.code = 2; throw e; }
  return D;
}
module.exports = { load, refuseInRepo, gitRootOf };
