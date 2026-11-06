const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error("Не удалось сохранить очередь"));
    tx.onabort = () => reject(tx.error || new Error("Запись очереди отменена"));
  });
const result = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
export class TeamOutbox {
  constructor(
    indexedDB = globalThis.indexedDB,
    { database = "gengroup-task-canvas-team-v1", namespace } = {},
  ) {
    this.idb = indexedDB;
    this.database = database;
    this.namespace = namespace;
  }
  async open() {
    if (this.db) return this.db;
    if (!this.idb)
      throw new Error(
        "Нужен доступ к хранилищу браузера для безопасной очереди.",
      );
    if (!this.opening)
      this.opening = new Promise((resolve, reject) => {
        const req = this.idb.open(this.database, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore("operations", { keyPath: "id" });
          req.result.createObjectStore("meta", { keyPath: "key" });
        };
        req.onsuccess = () => {
          this.db = req.result;
          this.db.onversionchange = () => {
            this.db.close();
            this.db = null;
            this.opening = null;
          };
          resolve(this.db);
        };
        req.onerror = () => {
          this.opening = null;
          reject(req.error);
        };
        req.onblocked = () =>
          reject(
            new Error(
              "Закройте старую тестовую вкладку для обновления хранилища.",
            ),
          );
      });
    return this.opening;
  }
  async list() {
    const db = await this.open(),
      tx = db.transaction("operations", "readonly"),
      rows = await result(tx.objectStore("operations").getAll());
    return rows
      .filter((row) => row.namespace === this.namespace)
      .sort((a, b) => a.sequence - b.sequence);
  }
  async addMany(operations, { hold = false } = {}) {
    if (!operations.length) return;
    const db = await this.open(),
      tx = db.transaction(["operations", "meta"], "readwrite"),
      finished = done(tx),
      ops = tx.objectStore("operations"),
      meta = tx.objectStore("meta");
    try {
      let sequence = (await result(meta.get(this.namespace)))?.sequence || 0;
      for (const operation of operations) {
        const existing = await result(ops.get(operation.id));
        if (existing) {
          if (JSON.stringify(existing.operation) !== JSON.stringify(operation))
            throw new Error("Операция с этим ID уже содержит другую правку.");
          continue;
        }
        ops.add({
          id: operation.id,
          namespace: this.namespace,
          sequence: ++sequence,
          operation: structuredClone(operation),
          held: hold,
          claim: null,
        });
      }
      meta.put({ key: this.namespace, sequence });
      await finished;
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      await finished.catch(() => {});
      throw error;
    }
  }
  async claim(id, worker, now = Date.now()) {
    const db = await this.open(),
      tx = db.transaction("operations", "readwrite"),
      finished = done(tx),
      store = tx.objectStore("operations"),
      row = await result(store.get(id));
    if (
      !row ||
      row.namespace !== this.namespace ||
      row.held ||
      (row.claim && row.claim.worker !== worker && now - row.claim.at < 120000)
    ) {
      await finished;
      return null;
    }
    row.claim = { worker, at: now };
    store.put(row);
    await finished;
    return row;
  }
  async acknowledge(id) {
    const db = await this.open(),
      tx = db.transaction("operations", "readwrite"),
      finished = done(tx),
      store = tx.objectStore("operations"),
      row = await result(store.get(id));
    if (row?.namespace === this.namespace) store.delete(id);
    await finished;
  }
  async release(id, worker) {
    const db = await this.open(),
      tx = db.transaction("operations", "readwrite"),
      finished = done(tx),
      store = tx.objectStore("operations"),
      row = await result(store.get(id));
    if (row?.namespace === this.namespace && row.claim?.worker === worker) {
      row.claim = null;
      store.put(row);
    }
    await finished;
  }
  async adoptPending(uid) {
    const db = await this.open(),
      tx = db.transaction("operations", "readwrite"),
      finished = done(tx),
      store = tx.objectStore("operations"),
      rows = await result(store.getAll());
    for (const row of rows)
      if (
        row.namespace === this.namespace &&
        !row.claim &&
        (row.operation.actor.uid === "pending-login" ||
          row.operation.actor.uid === uid)
      ) {
        if (row.operation.actor.uid === "pending-login")
          row.operation.actor.uid = uid;
        row.held = false;
        store.put(row);
      }
    await finished;
  }
}
