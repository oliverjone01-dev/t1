// Собирает запароленную версию сайта: TURBIUM/site/index.html -> turbium-locked.html
// Использование: node build-locked.mjs <пароль>
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const password = process.argv[2];
if (!password) { console.error('usage: node build-locked.mjs <password>'); process.exit(1); }

const html = readFileSync(join(here, '..', 'strategy', 'index.html'), 'utf8');
const salt = randomBytes(16);
const iv = randomBytes(12);
const ITER = 310000;
const key = pbkdf2Sync(password, salt, ITER, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(html, 'utf8'), cipher.final(), cipher.getAuthTag()]);

const payload = JSON.stringify({
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  ct: ct.toString('base64'),
  iter: ITER,
});

const page = `<title>TURBIUM · доступ по паролю</title>
<style>
  :root{--bg:#0A0F0D;--mint:#4EEAC0;--amber:#FF8C42;--grey:#8A9A94;--line:#1e2a25;--white:#F2F7F5}
  html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--white);font-family:system-ui,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;overflow:hidden}
  body::before{content:"";position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 47px,rgba(0,191,165,.05) 47px 48px),repeating-linear-gradient(90deg,transparent 0 47px,rgba(0,191,165,.05) 47px 48px)}
  .glow{position:fixed;width:70vw;height:60vh;top:-20vh;right:-20vw;background:radial-gradient(ellipse,rgba(78,234,192,.14),transparent 70%);filter:blur(80px)}
  .card{position:relative;width:min(400px,90vw);text-align:center;padding:20px}
  .el{width:120px;height:120px;margin:0 auto 30px;border:1px solid rgba(78,234,192,.55);border-radius:4px;position:relative;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,rgba(78,234,192,.08),transparent);box-shadow:0 0 50px rgba(78,234,192,.16)}
  .el .no{position:absolute;top:8px;left:10px;font:12px ui-monospace,monospace;color:var(--mint)}
  .el .sym{font-family:'Arial Narrow','Helvetica Neue',sans-serif;font-weight:800;font-size:56px;text-shadow:0 0 24px rgba(78,234,192,.5)}
  h1{font-family:'Arial Narrow','Helvetica Neue',sans-serif;font-weight:800;text-transform:uppercase;font-size:26px;letter-spacing:.04em;margin:0 0 8px}
  p{color:var(--grey);font-size:14px;margin:0 0 28px}
  form{display:flex;gap:10px}
  input{flex:1;background:#101613;border:1px solid var(--line);color:var(--white);padding:14px 16px;font-size:15px;border-radius:2px;font-family:ui-monospace,monospace;letter-spacing:.08em}
  input:focus{outline:none;border-color:var(--mint)}
  button{background:var(--mint);color:#062018;border:0;padding:14px 22px;font-family:'Arial Narrow','Helvetica Neue',sans-serif;font-weight:800;text-transform:uppercase;font-size:14px;letter-spacing:.06em;border-radius:2px;cursor:pointer;box-shadow:0 0 26px rgba(78,234,192,.3)}
  button:hover{box-shadow:0 0 40px rgba(78,234,192,.45)}
  button:disabled{opacity:.5;cursor:wait}
  .err{color:var(--amber);font:12px ui-monospace,monospace;letter-spacing:.06em;margin-top:16px;min-height:16px}
  .foot{margin-top:34px;font:11px ui-monospace,monospace;color:var(--grey);letter-spacing:.08em}
  .shake{animation:sh .4s}
  @keyframes sh{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
  @media(prefers-reduced-motion:reduce){.shake{animation:none}}
</style>
<div class="glow"></div>
<div class="card" id="card">
  <div class="el" aria-hidden="true"><span class="no">65</span><span class="sym">Tb</span></div>
  <h1>Turbium</h1>
  <p>Внутренний документ. Введите пароль доступа.</p>
  <form id="f">
    <input id="pw" type="password" autocomplete="current-password" placeholder="пароль" autofocus aria-label="Пароль">
    <button id="go" type="submit">Войти</button>
  </form>
  <div class="err" id="err" role="alert"></div>
  <div class="foot">AES-256-GCM · расшифровка в браузере · содержимое не покидает страницу</div>
</div>
<script>
const P=${payload};
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function unlock(pw){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(P.salt),iterations:P.iter,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(P.iv)},key,b64(P.ct));
  return new TextDecoder().decode(pt);
}
async function attempt(pw,silent){
  const go=document.getElementById('go'),err=document.getElementById('err');
  go.disabled=true;err.textContent=silent?'':'проверяю…';
  try{
    const html=await unlock(pw);
    try{sessionStorage.setItem('tb_pw',pw)}catch(e){}
    document.open();document.write(html);document.close();
  }catch(e){
    go.disabled=false;
    if(!silent){
      err.textContent='неверный пароль';
      const c=document.getElementById('card');c.classList.remove('shake');void c.offsetWidth;c.classList.add('shake');
    }else{err.textContent=''}
  }
}
document.getElementById('f').addEventListener('submit',e=>{e.preventDefault();const v=document.getElementById('pw').value;if(v)attempt(v,false)});
try{const s=sessionStorage.getItem('tb_pw');if(s)attempt(s,true)}catch(e){}
</script>
`;

writeFileSync(join(here, '..', 'strategy', 'strategy-locked.html'), page);
console.log('ok: turbium-locked.html,', ct.length, 'bytes ciphertext');
