/* Пересборка сайта ОП ГМ v4.
   Берёт public/index.html, расшифровывает данные паролем из OPGM_PW, подменяет блок Авито-данных
   свежим av.json, обновляет код и стили между маркерами AV, шифрует заново (gzip + AES-256-GCM).
   Запуск: OPGM_PW=... node src/build.cjs <путь к av.json> <путь к recon.json>
   Пароль и данные в открытом виде в репозиторий не кладутся. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const PW=process.env.OPGM_PW;if(!PW){console.error('Нужна переменная OPGM_PW');process.exit(1);}
const [avPath,reconPath]=process.argv.slice(2);if(!avPath||!reconPath){console.error('Укажите av.json и recon.json');process.exit(1);}
const HTML=path.join(__dirname,'..','public','index.html');
let s=fs.readFileSync(HTML,'utf8');
function between(a,b,repl,label){const i=s.indexOf(a),j=s.indexOf(b);if(i<0||j<i){console.error('не найден маркер '+label);process.exit(1);}s=s.slice(0,i+a.length)+'\n'+repl+'\n'+s.slice(j);}
between('/*AVCSS:BEGIN*/','/*AVCSS:END*/',fs.readFileSync(path.join(__dirname,'av.css'),'utf8'),'AVCSS');
between('/*AV:BEGIN*/','/*AV:END*/',fs.readFileSync(path.join(__dirname,'av.app.js'),'utf8'),'AV');
const m=s.match(/window\.OPGM_ENC=(\{.*?\});<\/script>/s);const E=JSON.parse(m[1]);
const key0=crypto.pbkdf2Sync(PW,Buffer.from(E.salt,'base64'),E.iter,32,'sha256');
const buf=Buffer.from(E.ct,'base64');const d=crypto.createDecipheriv('aes-256-gcm',key0,Buffer.from(E.iv,'base64'));d.setAuthTag(buf.subarray(buf.length-16));
let pt=Buffer.concat([d.update(buf.subarray(0,buf.length-16)),d.final()]);if(pt[0]===0x1f&&pt[1]===0x8b)pt=zlib.gunzipSync(pt);
const D=JSON.parse(pt.toString('utf8'));
D.av=JSON.parse(fs.readFileSync(avPath,'utf8'));D.av.recon=JSON.parse(fs.readFileSync(reconPath,'utf8'));
const plain=zlib.gzipSync(Buffer.from(JSON.stringify(D),'utf8'),{level:9});
const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=crypto.pbkdf2Sync(PW,salt,250000,32,'sha256');
const c=crypto.createCipheriv('aes-256-gcm',key,iv);const ct=Buffer.concat([c.update(plain),c.final(),c.getAuthTag()]);
const a=s.indexOf('window.OPGM_ENC=')+'window.OPGM_ENC='.length,b=s.indexOf(';</script>',a);
s=s.slice(0,a)+JSON.stringify({salt:salt.toString('base64'),iv:iv.toString('base64'),ct:ct.toString('base64'),iter:250000})+s.slice(b);
fs.writeFileSync(HTML,s);console.log('готово: чатов',D.av.chats.length,'| размер',s.length);
