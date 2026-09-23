/* Сборка сайта ОП ГМ на Контур DS 1.5.
   Запуск из папки op-gm-automation:
     OPGM_PW=... node src/build.cjs <av.json> <recon.json>
     смена пароля: OPGM_PW_OLD=<старый> OPGM_PW=<новый> node src/build.cjs ...
   1) расшифровывает текущие данные из public/index.html паролем из OPGM_PW;
   2) подменяет слой Авито (D.av) свежим av.json и recon.json;
   3) копирует файлы Контур DS из kontur-ds/ на сайт как есть, без правок;
   4) кладёт код экранов в public/app/, собирает index.html из src/shell.html;
   5) шифрует данные заново: gzip + AES-256-GCM, ключ PBKDF2 250 000.
   Пароль и данные в открытом виде в репозиторий не попадают. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const PW = process.env.OPGM_PW; if(!PW){ console.error('Нужна переменная OPGM_PW'); process.exit(1); }
// смена пароля: OPGM_PW_OLD расшифровывает текущую сборку, OPGM_PW шифрует новую
const PW_OLD = process.env.OPGM_PW_OLD || PW;
// ввод пароля нормализуется одинаково здесь и на странице входа (shell.html, normPw)
const normPw = x => x.normalize('NFC').trim().toLowerCase().replace(/ё/g, 'е').replace(/[\s_]+/g, '-');
const [avPath, reconPath] = process.argv.slice(2);
if(!avPath || !reconPath){ console.error('Укажите av.json и recon.json'); process.exit(1); }

/* 1. текущие данные */
const cur = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const E0 = JSON.parse(cur.match(/window\.OPGM_ENC=(\{.*?\});<\/script>/s)[1]);
/* ключ как на странице входа (normPw); сборки до нормализации шифровались сырым паролем, их пробуем вторыми */
function open0(pw){
  const k0 = crypto.pbkdf2Sync(pw, Buffer.from(E0.salt, 'base64'), E0.iter, 32, 'sha256');
  const b0 = Buffer.from(E0.ct, 'base64'), d0 = crypto.createDecipheriv('aes-256-gcm', k0, Buffer.from(E0.iv, 'base64'));
  d0.setAuthTag(b0.subarray(b0.length - 16));
  return Buffer.concat([d0.update(b0.subarray(0, b0.length - 16)), d0.final()]);
}
let pt; try{ pt = open0(normPw(PW_OLD)); }catch(e){ pt = open0(PW_OLD); }
if(pt[0] === 0x1f && pt[1] === 0x8b) pt = zlib.gunzipSync(pt);
const D = JSON.parse(pt.toString('utf8'));

/* 2. свежий слой Авито */
D.av = JSON.parse(fs.readFileSync(avPath, 'utf8'));
D.av.recon = JSON.parse(fs.readFileSync(reconPath, 'utf8'));

/* 3. Контур DS на сайт как есть: только то, что нужно браузеру */
for(const sub of ['tokens', 'kit']){
  const src = path.join(ROOT, 'kontur-ds', sub), dst = path.join(PUB, 'kontur-ds', sub);
  fs.mkdirSync(dst, { recursive:true });
  for(const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
}

/* 4. код экранов и страница */
fs.mkdirSync(path.join(PUB, 'app'), { recursive:true });
const APP = ['opgm.js', 'opgm.css', 'legacy.js'];
const h = crypto.createHash('sha256');
for(const f of APP){ const s = fs.readFileSync(path.join(__dirname, f)); h.update(s); fs.writeFileSync(path.join(PUB, 'app', f), s); }
for(const f of ['tokens/tokens.css', 'kit/kit.css', 'kit/kit.js', 'kit/charts.js', 'kit/icons.js', 'kit/brand.js', 'kit/motion.riv.js']) h.update(fs.readFileSync(path.join(ROOT, 'kontur-ds', f)));
const V = h.digest('hex').slice(0, 10);

/* 5. шифрование */
const plain = zlib.gzipSync(Buffer.from(JSON.stringify(D), 'utf8'), { level:9 });
const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), key = crypto.pbkdf2Sync(normPw(PW), salt, 250000, 32, 'sha256');
const c = crypto.createCipheriv('aes-256-gcm', key, iv), ct = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
const ENC = JSON.stringify({ salt:salt.toString('base64'), iv:iv.toString('base64'), ct:ct.toString('base64'), iter:250000 });
const html = fs.readFileSync(path.join(__dirname, 'shell.html'), 'utf8').split('{{V}}').join(V).replace('{{ENC}}', () => ENC);
fs.writeFileSync(path.join(PUB, 'index.html'), html);
console.log('готово: чатов', D.av.chats.length, '| версия', V, '| index.html', html.length, 'байт');
