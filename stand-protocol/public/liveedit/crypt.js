/* ============================================================================
   crypt.js - общий шифровальный слой для blockedit.js и versions.js.

   AES-256-GCM поверх PBKDF2-SHA256. Формат байтов совпадает с build-gate.js
   (iv 12 байт впереди, тег аутентификации внутри шифротекста), поэтому один и
   тот же ключ годится и для тела документа, и для патчей контента.

   Три способа получить объект шифрования:
     LiveCrypt.off                      - без шифрования (пустышка, те же методы)
     LiveCrypt.fromKey(cryptoKey)       - готовый CryptoKey (его отдаёт гейт)
     LiveCrypt.fromPassword(pw, saltB64, iter)

   Любой из них возвращает { on, encrypt(text) -> Promise<b64>, decrypt(b64) -> Promise<text> }.
   ========================================================================== */
(function () {
  'use strict';
  var S = window.crypto && window.crypto.subtle;

  function b64e(buf) {
    var b = new Uint8Array(buf), s = '', CH = 0x8000;
    for (var i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
    return btoa(s);
  }
  function b64d(s) {
    var b = atob(s), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }

  // aad привязывает шифротекст к его месту. Без неё payload одного блока
  // валидно расшифровывается на месте любого другого: ключ на документ один,
  // тег GCM сходится, подмена ячейки в таблице денег проходит незаметно и
  // не требует знания пароля, достаточно доступа к таблице.
  function wrap(keyPromise) {
    return {
      on: true,
      encrypt: function (text, aad) {
        return keyPromise.then(function (k) {
          var iv = crypto.getRandomValues(new Uint8Array(12));
          var p = { name: 'AES-GCM', iv: iv };
          if (aad) p.additionalData = new TextEncoder().encode(aad);
          return S.encrypt(p, k, new TextEncoder().encode(text))
            .then(function (ct) {
              var out = new Uint8Array(12 + ct.byteLength);
              out.set(iv, 0);
              out.set(new Uint8Array(ct), 12);
              return b64e(out);
            });
        });
      },
      decrypt: function (s, aad) {
        return keyPromise.then(function (k) {
          var raw = b64d(s);
          var p = { name: 'AES-GCM', iv: raw.slice(0, 12) };
          if (aad) p.additionalData = new TextEncoder().encode(aad);
          return S.decrypt(p, k, raw.slice(12))
            .then(function (buf) { return new TextDecoder().decode(buf); });
        });
      }
    };
  }

  window.LiveCrypt = {
    b64e: b64e,
    b64d: b64d,
    off: {
      on: false,
      encrypt: function (t) { return Promise.resolve(t); },
      decrypt: function (t) { return Promise.resolve(t); }
    },
    // Заголовок AES-GCM у патчей: iv[12] || ciphertext+tag.
    // У тела документа в build-gate.js формат другой, salt[16] || iv[12] || ct.
    // Совместимость между ними по ключу, а не по байтам, не перепутать.
    fromKey: function (k) { return wrap(Promise.resolve(k)); },
    fromPassword: function (pw, saltB64, iter) {
      var salt = b64d(saltB64), it = iter || 250000;
      var p = S.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey'])
        .then(function (km) {
          return S.deriveKey({ name: 'PBKDF2', salt: salt, iterations: it, hash: 'SHA-256' },
            km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        });
      return wrap(p);
    }
  };
})();
