/* ==========================================================================
   Вход по паролю. Данные страницы лежат в window.ENC зашифрованными (AES-256-GCM,
   ключ из пароля через PBKDF2-SHA256). Без пароля их не прочитать ни в браузере,
   ни в исходнике на GitHub. Пароль на время вкладки помнит sessionStorage.
   ========================================================================== */
(function(){
  const box = document.getElementById('lock');
  const form = document.getElementById('lock-form');
  const inp = document.getElementById('lock-pass');
  const err = document.getElementById('lock-err');
  const btn = document.getElementById('lock-btn');
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const store = { get(){ try{ return sessionStorage.getItem('gm-det-pass'); }catch(e){ return null; } },
                  set(v){ try{ sessionStorage.setItem('gm-det-pass', v); }catch(e){} } };

  async function open(pass){
    const E = window.ENC;
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name:'PBKDF2', salt:b64(E.salt), iterations:E.iter, hash:'SHA-256' }, base,
      { name:'AES-GCM', length:256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:b64(E.iv) }, key, b64(E.ct));
    window.DATA = JSON.parse(new TextDecoder().decode(plain));
    store.set(pass);
    box.remove();
    document.querySelector('.ks-app').hidden = false;
    window.startApp();
  }

  if(!window.crypto || !crypto.subtle){
    err.textContent = 'Браузер не поддерживает расшифровку. Откройте страницу по https или с диска в свежем Chrome, Safari или Firefox.';
    btn.disabled = true; return;
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Проверяю';
    try{ await open(inp.value); }
    catch(x){ err.textContent = 'Пароль не подошёл.'; btn.disabled = false; btn.textContent = 'Открыть'; inp.select(); }
  });
  const saved = store.get();
  if(saved) open(saved).catch(() => { inp.focus(); });
  else inp.focus();
})();
