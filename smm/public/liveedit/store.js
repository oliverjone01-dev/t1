/* ============================================================================
   store.js - хранилище для blockedit.js и versions.js.

   Два режима, один интерфейс:
     'local'                       - localStorage этого браузера
     {type:'supabase', url, key}   - таблицы doc_blocks и doc_versions

   LiveStore.blocks(cfg) -> { list(), put(blockId, payload, author), drop(blockId), wipe() }
   LiveStore.versions(cfg) -> { list(), add(row), drop(id) }

   cfg: { docKey, storage, tableBlocks, tableVersions }

   В теле хранится payload как есть. Шифрование накладывает вызывающий модуль
   через LiveCrypt, хранилище про него не знает и знать не должно.
   ========================================================================== */
(function () {
  'use strict';

  function rest(opt, table) {
    var base = opt.url.replace(/\/$/, '') + '/rest/v1/' + table;
    var h = { 'apikey': opt.key, 'Authorization': 'Bearer ' + opt.key, 'Content-Type': 'application/json' };
    return {
      get: function (q) {
        return fetch(base + '?' + q, { headers: h }).then(function (r) {
          if (!r.ok) throw new Error(table + ' get ' + r.status);
          return r.json();
        });
      },
      post: function (body, prefer) {
        return fetch(base, {
          method: 'POST',
          headers: Object.assign({ 'Prefer': prefer || 'return=representation' }, h),
          body: JSON.stringify(body)
        }).then(function (r) {
          if (!r.ok) return r.text().then(function (t) { throw new Error(table + ' post ' + r.status + ' ' + t); });
          return r.json();
        });
      },
      del: function (q) {
        return fetch(base + '?' + q, { method: 'DELETE', headers: h }).then(function (r) {
          if (!r.ok) throw new Error(table + ' del ' + r.status);
          return r;
        });
      }
    };
  }

  function lsKey(cfg, kind) { return 'liveedit:' + kind + ':' + cfg.docKey; }
  function lsRead(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function lsWrite(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  function blocks(cfg) {
    var isLocal = (cfg.storage === 'local' || !cfg.storage || !cfg.storage.url);
    var K = lsKey(cfg, 'blocks');
    if (isLocal) {
      return {
        local: true,
        list: function () { return Promise.resolve(lsRead(K)); },
        put: function (id, payload, author) {
          var all = lsRead(K).filter(function (r) { return r.block_id !== id; });
          all.push({ block_id: id, payload: payload, author: author, updated_at: new Date().toISOString() });
          lsWrite(K, all);
          return Promise.resolve();
        },
        drop: function (id) {
          lsWrite(K, lsRead(K).filter(function (r) { return r.block_id !== id; }));
          return Promise.resolve();
        },
        wipe: function () { lsWrite(K, []); return Promise.resolve(); }
      };
    }
    var api = rest(cfg.storage, cfg.tableBlocks || 'doc_blocks');
    var dk = encodeURIComponent(cfg.docKey);
    return {
      local: false,
      list: function () { return api.get('doc_key=eq.' + dk + '&select=block_id,payload,author,updated_at'); },
      put: function (id, payload, author) {
        return api.post([{
          doc_key: cfg.docKey, block_id: id, payload: payload,
          author: author || null, updated_at: new Date().toISOString()
        }], 'resolution=merge-duplicates,return=minimal');
      },
      drop: function (id) { return api.del('doc_key=eq.' + dk + '&block_id=eq.' + encodeURIComponent(id)); },
      wipe: function () { return api.del('doc_key=eq.' + dk); }
    };
  }

  function versions(cfg) {
    var isLocal = (cfg.storage === 'local' || !cfg.storage || !cfg.storage.url);
    var K = lsKey(cfg, 'versions');
    if (isLocal) {
      return {
        local: true,
        list: function () { return Promise.resolve(lsRead(K).slice().reverse()); },
        add: function (row) {
          var all = lsRead(K);
          row.id = (all.length ? all[all.length - 1].id + 1 : 1);
          row.created_at = new Date().toISOString();
          all.push(row);
          while (all.length > 60) all.shift();      // локально держим последние 60
          lsWrite(K, all);
          return Promise.resolve(row);
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
      list: function () {
        return api.get('doc_key=eq.' + dk + '&select=id,label,snapshot,author,created_at&order=created_at.desc&limit=80');
      },
      add: function (row) {
        row.doc_key = cfg.docKey;
        return api.post([row]).then(function (a) { return a[0]; });
      },
      drop: function (id) { return api.del('id=eq.' + encodeURIComponent(id)); }
    };
  }

  window.LiveStore = { blocks: blocks, versions: versions };
})();
