import {
  bootstrapBoard,
  mergeBoards,
  comparable,
  equal,
  SYNC_FIELDS,
} from "./sync-model.mjs?rev=20261109-gantt-1";
import { validateBoard } from "./model.mjs?rev=20261109-gantt-1";
import { remoteChanges } from "./changes.mjs?rev=20261109-gantt-1";
const cleanBoard = (board) => {
  if (
    board?.owners &&
    (!Array.isArray(board.owners) ||
      board.owners.some((owner) => typeof owner !== "string"))
  )
    throw new Error("Повреждены дорожки доски.");
  return { tasks: validateBoard(board), owners: board.owners || [] };
};
function cleanConflicts(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Повреждена очередь конфликтов.");
  for (const conflict of value) {
    if (
      !conflict ||
      typeof conflict.id !== "string" ||
      !conflict.id ||
      !["task", ...SYNC_FIELDS].includes(conflict.field)
    )
      throw new Error("Повреждён конфликт.");
    for (const version of ["base", "local", "remote"]) {
      const item = conflict[version];
      if (item == null) continue;
      if (conflict.field === "task") {
        if (item.id !== conflict.id)
          throw new Error("ID конфликта не совпадает.");
        validateBoard([item]);
      } else if (conflict.field === "positions") {
        if (typeof item !== "object" || Array.isArray(item))
          throw new Error("Повреждены позиции.");
      } else if (typeof item !== "string")
        throw new Error("Повреждено поле конфликта.");
      if (
        conflict.field === "priority" &&
        item &&
        !["do", "plan", "delegate", "later"].includes(item)
      )
        throw new Error("Повреждён приоритет.");
      if (conflict.field === "due" && item)
        validateBoard([{ id: "check", title: "Проверка", due: item }]);
    }
  }
  return value;
}
export class SyncEngine {
  constructor({
    api,
    getLocal,
    apply,
    onState,
    onRemote = () => {},
    cache = null,
    readOnly = false,
    schedule = (...args) => setTimeout(...args),
    cancel = (...args) => clearTimeout(...args),
  }) {
    this.api = api;
    this.getLocal = getLocal;
    this.apply = apply;
    this.onState = onState;
    this.schedule = schedule;
    this.cancel = cancel;
    this.onRemote = onRemote;
    this.readOnly = readOnly;
    this.base = null;
    this.conflicts = [];
    this.enabled = false;
    this.connected = false;
    this.busy = false;
    this.timer = null;
    this.retryDelay = 20000;
    this.generation = 0;
    this.lastReadAt = Number.isFinite(cache?.lastReadAt) ? cache.lastReadAt : 0;
    try {
      if (
        cache !== null &&
        (typeof cache !== "object" ||
          Array.isArray(cache) ||
          !Object.hasOwn(cache, "base") ||
          (cache.version !== undefined && cache.version !== 1) ||
          (cache.enabled !== undefined && typeof cache.enabled !== "boolean"))
      )
        throw new Error();
      if (cache?.cacheInvalid) throw new Error();
      if (
        cache?.base !== undefined &&
        cache.base !== null &&
        typeof cache.base !== "object"
      )
        throw new Error();
      cleanConflicts(cache?.conflicts);
      if (cache?.base) {
        this.base = cleanBoard(cache.base);
        this.conflicts = cleanConflicts(cache.conflicts);
        this.enabled = !!cache.enabled;
      }
    } catch {
      this.cacheInvalid = true;
      this.base = null;
      this.conflicts = [];
    }
    this.loadedBaseline = !!this.base;
    this.state(
      this.cacheInvalid ? "cache-error" : this.enabled ? "signin" : "local",
    );
  }
  snapshot() {
    return {
      version: 1,
      enabled: this.enabled,
      base: this.base,
      conflicts: this.conflicts,
      lastReadAt: this.lastReadAt,
      cacheInvalid: !!this.cacheInvalid,
    };
  }
  state(status, message = "") {
    this.status = status;
    this.message = message;
    this.onState?.({
      status,
      message,
      conflicts: this.conflicts,
      pending: this.pending(),
      busy: this.busy,
      enabled: this.enabled,
      connected: this.connected,
      lastReadAt: this.lastReadAt,
    });
  }
  pending() {
    if (!this.base) return 0;
    const plan = mergeBoards(this.base, cleanBoard(this.getLocal()), this.base);
    return (
      plan.writes.length +
      plan.conflicts.length +
      (equal([...this.base.owners].sort(), [...this.getLocal().owners].sort())
        ? 0
        : 1)
    );
  }
  later(delay = 20000) {
    this.cancel(this.timer);
    if (this.connected) this.timer = this.schedule(() => this.flush(), delay);
  }
  changed() {
    if (!this.enabled) return;
    this.state(this.connected ? "pending" : "signin");
    this.later(1000);
  }
  async connect() {
    if (this.readOnly)
      throw new Error("В демонстрации синхронизация с Google отключена.");
    if (this.cacheInvalid)
      throw new Error(
        "Очередь синхронизации повреждена. Скачайте копию доски и пересоздайте связь с таблицей.",
      );
    this.generation++;
    this.enabled = true;
    this.connected = true;
    return this.flush();
  }
  disconnect() {
    this.generation++;
    this.connected = false;
    this.cancel(this.timer);
    this.state(this.cacheInvalid ? "cache-error" : "signin");
  }
  resetBaseline() {
    this.disconnect();
    this.base = null;
    this.conflicts = [];
    this.enabled = false;
    this.cacheInvalid = false;
    this.loadedBaseline = false;
    this.bootstrapped = false;
    this.lastReadAt = 0;
    this.state("local");
  }
  async flush() {
    if (this.readOnly) return;
    if (!this.connected || this.busy) return;
    if (this.conflicts.length) {
      this.state("conflict");
      return;
    }
    this.busy = true;
    this.state("syncing");
    const generation = this.generation;
    const ensureConnected = () => {
      if (!this.connected || this.generation !== generation)
        throw Object.assign(new Error("Синхронизация остановлена."), {
          cancelled: true,
        });
    };
    try {
      let remote = await this.api.read();
      ensureConnected();
      this.lastReadAt = Date.now();
      const changes = remoteChanges(
        this.base,
        remote.board,
        cleanBoard(this.getLocal()),
      );
      if (!this.base) this.base = remote.board;
      let local = cleanBoard(this.getLocal());
      if (!this.bootstrapped) {
        // A restored cache already has a baseline; only a genuinely new connection imports layout.
        if (!this.loadedBaseline) local = bootstrapBoard(local, remote.board);
      }
      this.bootstrapped = true;
      let plan = mergeBoards(this.base, local, remote.board);
      this.conflicts = plan.conflicts;
      this.onRemote(changes);
      const captured = cleanBoard(plan.board);
      this.base = cleanBoard(remote.board);
      this.apply(captured, this.snapshot());
      if (
        plan.writes.length ||
        !equal([...remote.board.owners].sort(), [...captured.owners].sort())
      ) {
        ensureConnected();
        await this.api.write(remote, plan.writes, captured.owners);
        ensureConnected();
        const acknowledged = await this.api.read();
        ensureConnected();
        this.lastReadAt = Date.now();
        this.onRemote(
          remoteChanges(remote.board, acknowledged.board, captured),
        );
        const observed = new Map(
          acknowledged.board.tasks.map((t) => [t.id, t]),
        );
        for (const write of plan.writes) {
          const actual = observed.get(write.id),
            expected = write.task;
          if (write.type === "archive" && actual)
            this.conflicts.push({
              id: write.id,
              field: "task",
              title: actual.title,
              base: actual,
              local: null,
              remote: actual,
            });
          if (write.type !== "archive" && !actual) {
            this.conflicts.push({
              id: write.id,
              field: "task",
              title: expected.title,
              local: expected,
              remote: null,
              base: remote.board.tasks.find((t) => t.id === write.id) || null,
            });
            continue;
          }
          if (write.type !== "archive")
            for (const field of write.fields ||
              Object.keys(comparable(expected))) {
              if (
                !equal(
                  comparable(actual)?.[field],
                  comparable(expected)?.[field],
                )
              )
                this.conflicts.push({
                  id: write.id,
                  field,
                  title: expected.title,
                  local: expected[field],
                  remote: actual?.[field],
                  base: remote.board.tasks.find((t) => t.id === write.id)?.[
                    field
                  ],
                });
            }
        }
        const now = cleanBoard(this.getLocal());
        // Keep edits made while the request was in flight; never acknowledge them prematurely.
        const follow = mergeBoards(captured, now, acknowledged.board);
        this.conflicts.push(...follow.conflicts);
        remote = acknowledged;
        plan = { ...follow, board: follow.board };
        for (const c of this.conflicts) {
          if (c.field === "task") {
            plan.board.tasks = plan.board.tasks.filter((t) => t.id !== c.id);
            if (c.local) plan.board.tasks.push(c.local);
          } else {
            const t = plan.board.tasks.find((t) => t.id === c.id);
            if (t) t[c.field] = c.local;
          }
        }
      }
      this.base = cleanBoard(remote.board);
      this.retryDelay = 20000;
      this.apply(plan.board, this.snapshot());
      this.state(
        this.conflicts.length
          ? "conflict"
          : this.pending()
            ? "pending"
            : "synced",
      );
      if (!this.conflicts.length) this.later(this.pending() ? 1000 : 20000);
    } catch (error) {
      if (error.cancelled) {
        this.state(this.connected ? "pending" : "signin");
      } else if (error.auth) {
        this.connected = false;
        this.state("signin", error.message);
      } else {
        this.state("offline", error.message);
        this.later(this.retryDelay);
        this.retryDelay = Math.min(120000, this.retryDelay * 2);
      }
    } finally {
      this.busy = false;
      this.state(this.status, this.message);
      if (this.connected && generation !== this.generation) this.later(0);
    }
  }
  resolve(choices) {
    const board = cleanBoard(this.getLocal());
    for (const [index, c] of this.conflicts.entries()) {
      if (choices[index] !== "remote") continue;
      if (c.field === "task") {
        board.tasks = board.tasks.filter((t) => t.id !== c.id);
        if (c.remote) board.tasks.push(c.remote);
      } else {
        const task = board.tasks.find((t) => t.id === c.id);
        if (task) task[c.field] = c.remote;
      }
    }
    this.conflicts = [];
    this.apply(board, this.snapshot());
    this.state("pending");
    this.later(0);
  }
}
