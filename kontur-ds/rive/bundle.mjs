// Контур DS · пересборка kit/motion.riv.js из rive/sync.riv, rive/success.riv, rive/empty.riv
//   rive rive/sync --once && cp rive/sync/build/sync.riv rive/   (так же success и empty)
//   node rive/bundle.mjs
import fs from 'fs';
const here = new URL('.', import.meta.url).pathname, kit = new URL('../kit/', import.meta.url).pathname;
const b64 = n => fs.readFileSync(here + n + '.riv').toString('base64');
const out = `/* Контур DS · анимации Rive (1.4): sync 24x24, success 48x48, empty 160x96.
   Собраны официальным Rive CLI 1.1.1 из RML (исходники в rive/), без скриптов Luau.
   Управление через View Model: у sync число state 0..3, у всех цвета ink, muted, accent, ok, crit.
   Подключается KS.rive.enable(); без него на странице работают родные анимации кита. */
window.KS_RIVE_FILES = { sync:'${b64('sync')}', success:'${b64('success')}', empty:'${b64('empty')}' };
`;
fs.writeFileSync(kit + 'motion.riv.js', out);
console.log('kit/motion.riv.js', out.length, 'байт');
