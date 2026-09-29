/* Корень op-gm-automation для инструментов стенда (ТЗ ФЕНИКСА iter2 п.11: без жёстких путей).
   Порядок: --op, переменная окружения OP, папка на уровень выше tools/ (после переезда в op-gm-automation/tools/, Д0). Иначе код 2. */
const fs = require('fs'), path = require('path');
module.exports = function opRoot(arg){
  const c = arg || process.env.OP || path.resolve(__dirname, '..', '..');
  if(!fs.existsSync(path.join(c, 'src', 'opgm.js'))){ console.error('ОШИБКА: не найден корень op-gm-automation (' + c + '/src/opgm.js). Укажите --op <op-gm-automation> или OP=...'); process.exit(2); }
  return path.resolve(c);
};
