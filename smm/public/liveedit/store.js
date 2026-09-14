/* ============================================================================
   store.js - хранилище для blockedit.js и versions.js.

   Два режима, один интерфейс:
     'local'                       - localStorage этого браузера
     {type:'supabase', url, key}   - таблицы doc_blocks и doc_versions

   LiveStore.blocks(cfg)   -> { list(), put(id, payload, author), drop(id), wipe() }
   LiveStore.versions(cfg) -> { list(), add(row), drop(id) }

   cfg: { docKey, storage, tableBlocks, tableVersions, crypt }

   В теле хранится payload как есть. Шифрование накладывает вызывающий модуль,
   хранилище про него не знает и знать не должно, только проставляет флаг crypt
   в строке, чтобы схема не врала про содержимое.

   Право на запись проверяет сервер (политики RLS "to authenticated"), а
   заголовки берутся из LiveAuth: пока не вошли, уходит anon-ключ и запись
   отлетает с 401. Раньше запись была открыта анониму, и один DELETE стирал
   и весь контент, и всю историю.
   ========================================================================== */
(function () {
  'use strict';

  var TIMEOUT = 8000;
  var MAX_BLOCKS = 2000;
  var MAX_PAYLOAD = 200 * 1024;    // 200 КБ на блок, выше в документе не бывает
  var MAX_BEACON = 60 * 1024;      // предел keepalive в браузерах, 64 КБ на запрос

  function headers(opt) {
    if (window.LiveAuth && window.LiveAuth.ready()) return window.LiveAuth.headers();
    return { 'apikey': opt.key, 'Authorization': 'Bearer ' + opt.key, 'Content-Type': 'application/json' };
  }

  // Ответ PostgREST при Prefer: return=minimal пустой. r.json() на нём кидает
  // SyntaxError, и удачная запись выглядит как провал.
  function body(r, table) {
    if (!r.ok) {
      return r.text().then(function (t) {
        if (r.status === 401 || r.status === 403) throw new Error('нет прав на запись, войдите заново');
        throw new Error(table + ' ' + r.status + (t ? ' ' + t.slice(0, 160) : ''));
      });
    }
    if (r.status === 204) return null;
    return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
  }

  function go(url, init, table) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    if (ctl) init.signal = ctl.signal;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);
    return fetch(url, init)
      .then(function (r) { clearTimeout(t); return body(r, table); })
      .catch(function (e) {
        clearTimeout(t);
        throw (e.name === 'AbortError') ? new Error(table + ': сервер не ответил за ' + (TIMEOUT / 1000) + ' с') : e;
      });
  }

  function rest(opt, table) {
    var base = opt.url.replace(/\/$/, '') + '/rest/v1/' + table;
    return {
      get: function (q) { return go(base + '?' + q, { headers: headers(opt) }, table); },
      post: function (b, prefer) {
        return go(base, {
          method: 'POST',
          headers: Object.assign({ 'Prefer': prefer || 'return=representation' }, headers(opt)),
          body: JSON.stringify(b)
        }, table);
      },
      beacon: function (b, prefer) {
        // Уход со страницы: обычный fetch браузер убивает, keepalive доживает.
        // Но keepalive ограничен 64 КБ, поэтому крупный блок так не уходит и
        // об этом надо сказать честно, а не сделать вид, что сохранили.
        var body = JSON.stringify(b);
        if (body.length > MAX_BEACON) return Promise.reject(new Error('слишком большой блок для отправки при закрытии'));
        return fetch(base, {
          method: 'POST', keepalive: true,
          headers: Object.assign({ 'Prefer': prefer || 'return=minimal' }, headers(opt)),
          body: body
        }).then(function (r) {
          // молча резолвить 401 нельзя: последняя правка потерялась бы без следа
          if (!r.ok) throw new Error(table + ' ' + r.status);
        });
      },
      del: function (q) { return go(base + '?' + q, { method: 'DELETE', headers: headers(opt) }, table); }
    };
  }

  function lsKey(cfg, kind) { return 'liveedit:' + kind + ':' + cfg.docKey; }
  function lsRead(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function lsWrite(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  function isLocal(cfg) { return cfg.storage === 'local' || !cfg.storage || !cfg.storage.url; }

  function blocks(cfg) {
    var K = lsKey(cfg, 'blocks');
    if (isLocal(cfg)) {
      return {
        local: true,
        list: function () { return Promise.resolve(lsRead(K)); },
        put: function (id, payload, author) {
          var all = lsRead(K).filter(function (r) { return r.block_id !== id; });
          all.push({ block_id: id, payload: payload, author: author, updated_at: new Date().toISOString() });
          lsWrite(K, all);
          return Promise.resolve();
        },
        putSync: function (id, payload, author) { return this.put(id, payload, author); },
        drop: function (id) {
          lsWrite(K, lsRead(K).filter(function (r) { return r.block_id !== id; }));
          return Promise.resolve();
        },
        wipe: function () { lsWrite(K, []); return Promise.resolve(); }
      };
    }
    var api = rest(cfg.storage, cfg.tableBlocks || 'doc_blocks');
    var dk = encodeURIComponent(cfg.docKey);
    function row(id, payload, author) {
      if (payload.length > MAX_PAYLOAD) throw new Error('блок слишком большой');
      return {
        doc_key: cfg.docKey, block_id: id, payload: payload,
        crypt: !!(cfg.crypt && cfg.crypt.on), author: author || null,
        updated_at: new Date().toISOString()
      };
    }
    return {
      local: false,
      list: function () {
        return api.get('doc_key=eq.' + dk + '&select=block_id,payload,author,updated_at&limit=' + MAX_BLOCKS)
          .then(function (a) {
            a = a || [];
            // молчаливое усечение читалось бы как «всё загружено»
            if (a.length === MAX_BLOCKS) a.truncated = MAX_BLOCKS;
            return a;
          });
      },
      put: function (id, payload, author) {
        return api.post([row(id, payload, author)], 'resolution=merge-duplicates,return=minimal');
      },
      putSync: function (id, payload, author) {
        try {
          return api.beacon([row(id, payload, author)], 'resolution=merge-duplicates,return=minimal');
        } catch (e) { return Promise.resolve(); }
      },
      drop: function (id) { return api.del('doc_key=eq.' + dk + '&block_id=eq.' + encodeURIComponent(id)); },
      wipe: function () { return api.del('doc_key=eq.' + dk); }
    };
  }

  function versions(cfg) {
    var K = lsKey(cfg, 'versions');
    if (isLocal(cfg)) {
      return {
        local: true,
        list: function () { return Promise.resolve(lsRead(K).slice().reverse()); },
        add: function (r) {
          var all = lsRead(K);
          r.id = (all.length ? all[all.length - 1].id + 1 : 1);
          r.created_at = new Date().toISOString();
          all.push(r);
          var cut = 0;
          while (all.length > 60) { all.shift(); cut++; }
          if (cut) r.__trimmed = cut;          // молча не выбрасываем, модуль скажет
          lsWrite(K, all);
          return Promise.resolve(r);
        },
        drop: function (id) {
          lsWrite(K, lsRead(K).filter(function (r) { return String(r.id) !== String(id); }));
          return Promise.resolve();
        }
      };
    }
    var api = rest(cfg.storage, cfg.tableVersions || 'doc_versions');
    var dk = encodeURIComponent(cfg.docKey);
    return {
      local: false,
      // offset позволяет добраться до старых версий, если свежие забиты мусором
      list: function (offset, limit) {
        return api.get('doc_key=eq.' + dk +
          '&select=id,label,snapshot,author,created_at&order=created_at.desc' +
          '&limit=' + (limit || 40) + '&offset=' + (offset || 0)).then(function (a) { return a || []; });
      },
      add: function (r) {
        r.doc_key = cfg.docKey;
        return api.post([r]).then(function (a) { return (a && a[0]) || r; });
      },
      // фильтр по doc_key обязателен: иначе вошедший стирает версию любого
      // документа проекта, просто угадав числовой id
      drop: function (id) { return api.del('doc_key=eq.' + dk + '&id=eq.' + encodeURIComponent(id)); }
    };
  }

  window.LiveStore = { blocks: blocks, versions: versions };
})();
