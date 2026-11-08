import {
  seedEntry,
  validateEntry,
  toBoard,
  makeOperation,
  projectOperation,
  GROUPS,
  groupValue,
  GROUP_NAMES,
} from "./team-model.mjs?rev=20261108-ui-2";
import { equal, bootstrapBoard } from "./sync-model.mjs?rev=20261108-ui-2";
import { remoteChanges } from "./changes.mjs?rev=20261108-ui-2";
import { TeamOutbox } from "./team-outbox.mjs?rev=20261108-ui-2";
const clone = (v) => structuredClone(v),
  id = () => crypto.randomUUID();
export class TeamSyncEngine {
  constructor({
    getLocal,
    apply,
    onState,
    onRemote = () => {},
    cache = null,
    outbox = null,
    schedule = (...args) => setTimeout(...args),
    cancel = (...args) => clearTimeout(...args),
    boardId,
    clientId = id(),
  }) {
    this.managed = true;
    this.getLocal = getLocal;
    this.apply = apply;
    this.onState = onState;
    this.onRemote = onRemote;
    this.schedule = schedule;
    this.cancel = cancel;
    this.clientId = clientId;
    this.api = null;
    this.repository = null;
    this.bridge = null;
    this.entries = new Map();
    this.view = new Map();
    this.owners = [];
    this.queue = [];
    this.optimistic = [];
    this.conflicts = [];
    this.rawConflicts = [];
    this.history = [];
    this.generation = 0;
    this.busy = false;
    this.retryDelay=3000;
    this.connected = false;
    this.enabled = !!cache?.enabled;
    this.status = this.enabled ? "signin" : "local";
    this.lastReadAt = cache?.lastReadAt || 0;
    this.sourceState = cache?.sourceState || {
      status: "pending",
      checkedAt: 0,
    };
    this.actor = {
      uid: cache?.actor?.uid || "pending-login",
      name: cache?.actor?.name || "Участник команды",
      clientId,
    };
    this.hasSeenRemote = cache?.version === 2 || !!cache?.base;
    this.legacy = cache?.version === 2 ? null : cache;
    this.base = cache?.version === 2 ? {} : cache?.base || null;
    try {
      if (cache?.version === 2) {
        for (const value of cache.entries || []) {
          const entry = validateEntry(value);
          this.entries.set(entry.task.id, entry);
        }
        this.owners = Array.isArray(cache.owners) ? cache.owners : [];
        this.rawConflicts = cache.conflicts || [];
      } else if (cache?.base) {
        for (const task of cache.base.tasks)
          this.entries.set(task.id, seedEntry(task, "legacy"));
        this.owners = cache.base.owners || [];
      }
    } catch {
      this.cacheInvalid = true;
      this.entries.clear();
    }
    this.outbox = outbox || new TeamOutbox(undefined, { namespace: boardId });
    this.loadedBaseline = cache?.version === 2;
    this.reproject(false);
    this.state(this.cacheInvalid ? "cache-error" : this.status);
  }
  async ready() {
    try {
      this.queue = await this.outbox.list();
      this.queueError = "";
      this.reproject(false);
      this.state(this.status);
    } catch (error) {
      this.queueError = error.message;
      this.state("cache-error", error.message);
      throw error;
    }
  }
  capture() {
    return {
      entries: new Map(
        [...this.view].map(([key, value]) => [key, clone(value)]),
      ),
      owners: clone(this.projectedOwners || this.owners),
    };
  }
  snapshot() {
    return {
      version: 2,
      enabled: this.enabled,
      entries: [...this.entries.values()],
      owners: this.owners,
      conflicts: this.rawConflicts,
      lastReadAt: this.lastReadAt,
      sourceState: this.sourceState,
      actor: { uid: this.actor.uid, name: this.actor.name },
      cacheInvalid: !!this.cacheInvalid,
    };
  }
  pending() {
    return this.queue.length + this.optimistic.length;
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
      managed: true,
      sourceState: this.sourceState,
    });
  }
  refreshConflicts() {
    this.conflicts = this.rawConflicts
      .filter((c) => c.status === "open")
      .map((c) => {
        const entry = this.entries.get(c.taskId),
          version =
            c.group === "task"
              ? entry
                ? entry.lastOperationId
                : "missing"
              : entry?.versions[c.group];
        const remote =
          c.group === "task"
            ? entry
              ? { task: entry.task, archived: entry.archived }
              : null
            : entry
              ? groupValue(entry.task, c.group)
              : null;
        return {
          ...c,
          field: c.group,
          title: entry?.task.title || c.title || c.taskId,
          originalRemote: c.remote,
          remote,
          remoteVersion: version,
          fieldName: GROUP_NAMES[c.group],
        };
      });
  }
  reproject(apply = true) {
    this.view = new Map(
      [...this.entries].map(([key, value]) => [key, clone(value)]),
    );
    let owners = [...this.owners];
    for (const row of [...this.queue, ...this.optimistic]) {
      const op = row.operation || row;
      if (op.kind === "lanes") {
        owners = [
          ...new Set([
            ...owners.filter((name) => !op.remove.includes(name)),
            ...op.add,
          ]),
        ];
        continue;
      }
      const projected = projectOperation(this.view.get(op.taskId), op);
      if (projected) this.view.set(op.taskId, projected);
    }
    this.projectedOwners = owners;
    this.refreshConflicts();
    if (apply)
      this.apply(toBoard([...this.view.values()], owners), this.snapshot());
  }
  async changed({ basis, desired, recover = false, versionBasis = null }) {
    if (this.cacheInvalid)
      throw new Error(
        "Очередь повреждена. Сначала скачайте копию и восстановите связь.",
      );
    if (this.queueError) await this.ready();
    const operations = [],
      after = new Map(desired.tasks.map((task) => [task.id, task]));
    for (const [taskId, entry] of basis.entries) {
      if (entry.archived && !after.has(taskId)) continue;
      const op = makeOperation(entry, after.get(taskId) || null, {
        id: id(),
        actor: this.actor,
      });
      if (op) operations.push(op);
      after.delete(taskId);
    }
    for (const task of after.values()) {
      const op = makeOperation(null, task, { id: id(), actor: this.actor });
      if (op) operations.push(op);
    }
    const add = desired.owners.filter((name) => !basis.owners.includes(name)),
      remove = basis.owners.filter((name) => !desired.owners.includes(name));
    if (add.length || remove.length)
      operations.push({
        schema: 1,
        id: id(),
        kind: "lanes",
        taskId: "__lanes",
        actor: clone(this.actor),
        add,
        remove,
        submittedAt: Date.now(),
      });
    if (versionBasis)
      for (const operation of operations) {
        const original = versionBasis.entries.get(operation.taskId);
        if (!original) continue;
        if (operation.kind === "edit")
          for (const [group, patch] of Object.entries(operation.groups)) {
            patch.baseVersion = original.versions[group];
            patch.base = groupValue(original.task, group);
          }
        if (operation.kind === "archive") {
          operation.baseRevision = original.revision;
          operation.baseLife = original.lifeVersion;
        }
      }
    if (recover) {
      for (let i = operations.length - 1; i >= 0; i--) {
        const op = operations[i],
          queued = this.queue
            .map((r) => r.operation)
            .filter((other) => other.taskId === op.taskId);
        if (op.kind === "edit") {
          for (const key of Object.keys(op.groups))
            if (
              queued.some(
                (other) =>
                  other.kind === "create" ||
                  (other.kind === "edit" && other.groups[key]),
              )
            )
              delete op.groups[key];
          if (!Object.keys(op.groups).length) operations.splice(i, 1);
        } else if (queued.length) operations.splice(i, 1);
      }
    }
    if (!operations.length) return true;
    this.optimistic.push(...operations);
    this.reproject();
    try {
      await this.outbox.addMany(operations, { hold: !this.enabled });
      this.queue = await this.outbox.list();
    } catch (error) {
      this.queueError = error.message;
      throw new Error(
        "Не удалось записать безопасную очередь. Текст оставлен в редакторе. " +
          error.message,
      );
    } finally {
      const ids = new Set(operations.map((op) => op.id));
      this.optimistic = this.optimistic.filter((op) => !ids.has(op.id));
      this.reproject();
    }
    this.channel?.postMessage("changed");
    this.state(this.connected ? "pending" : this.enabled ? "signin" : "local");
    this.later(0);
    return true;
  }
  later(delay = 1000) {
    this.cancel(this.timer);
    if (this.connected) this.timer = this.schedule(() => this.flush(), delay);
  }
  async connect() {
    if (this.cacheInvalid)
      throw new Error(
        "Повреждена версия очереди. Скачайте копию и восстановите связь.",
      );
    if (!this.repository)
      throw new Error("Командная синхронизация ещё загружается.");
    const generation = ++this.generation;
    this.enabled = true;
    this.state("syncing");
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.connected = false;
    await this.bridge?.stop();
    if (generation !== this.generation) return;
    try {
      await this.outbox.open();
      if (generation !== this.generation) return;
      const localBefore = clone(this.getLocal()),
        migrating = !this.loadedBaseline;
      await this.repository.authenticate(this.googleAuth.getToken());
      if (generation !== this.generation) return;
      this.actor = { ...this.repository.actor(this.clientId) };
      await this.outbox.adoptPending(this.actor.uid);
      this.queue = await this.outbox.list();
      const remote = await this.repository.read();
      if (generation !== this.generation) return;
      this.accessRoot = remote.root;
      this.accept(remote, false);
      this.connected = true;
      // Convert the old local copy once; unversioned changes remain explicit conflicts, never blind overwrites.
      if (migrating) {
        const base = this.legacy?.base;
        const desired = base
          ? localBefore
          : bootstrapBoard(
              localBefore,
              toBoard([...this.entries.values()], this.owners),
            );
        let basis;
        if (base)
          basis = {
            entries: new Map(
              base.tasks.map((task) => [task.id, seedEntry(task, "legacy")]),
            ),
            owners: base.owners || [],
          };
        else basis = this.capture();
        await this.changed({ basis, desired, recover: true });
        this.loadedBaseline = true;
        this.legacy = null;
      }
      this.unsubscribe = this.repository.subscribe(
        (data) => {
          if (generation !== this.generation) return;
          try {
            this.accessRoot = data.root;
            this.accept(data, !data.fromCache);
            if (!data.fromCache)
              this.state(
                this.conflicts.length
                  ? "conflict"
                  : this.pending()
                    ? "pending"
                    : "synced",
              );
          } catch (error) {
            this.state("cache-error", error.message);
          }
        },
        (error) => {
          if (generation === this.generation)
            this.state(error.code === "permission-denied" ? "access-denied" : "offline", error.message);
        },
      );
      this.channel ??=
        typeof BroadcastChannel === "function"
          ? new BroadcastChannel("gengroup-task-team-outbox")
          : null;
      if (this.channel)
        this.channel.onmessage = async () => {
          try {
            this.queue = await this.outbox.list();
            this.reproject();
            this.later(0);
          } catch (error) {
            this.state("cache-error", error.message);
          }
        };
      this.reproject();
      this.state(
        this.conflicts.length
          ? "conflict"
          : this.pending()
            ? "pending"
            : "synced",
      );
      this.later(0);
      this.bridge?.start();
    } catch (error) {
      if (generation === this.generation) {
        this.connected = false;
        this.state("signin", error.message);
      }
      throw error;
    }
  }
  accept(data, confirmed = true) {
    const before = toBoard([...this.entries.values()], this.owners),
      next = new Map(
        data.entries.map((entry) => [entry.task.id, validateEntry(entry)]),
      );
    this.entries = next;
    if (data.source) this.sourceState = data.source;
    this.owners = data.lanes.items || [];
    this.rawConflicts = data.conflicts || [];
    if (confirmed) this.lastReadAt = Date.now();
    this.base = {};
    this.loadedBaseline = true;
    const after = toBoard([...next.values()], this.owners);
    this.onRemote(
      remoteChanges(this.hasSeenRemote ? before : null, after, this.getLocal()),
    );
    this.hasSeenRemote = true;
    this.reproject();
  }
  async refresh() {
    if (!this.connected) return;
    const generation = this.generation,
      data = await this.repository.read();
    if (generation !== this.generation) return;
    this.accept(data);
  }
  async flush() {
    if (!this.connected || this.busy) return;
    const generation = this.generation;
    this.busy = true;
    this.state("syncing");
    try {
      this.queue = await this.outbox.list();
      const hadWork = this.queue.some((row) => !row.held);
      for (const row of this.queue) {
        if (!this.connected || generation !== this.generation) break;
        if (row.operation.actor.uid !== this.actor.uid) {
          this.state(
            "signin",
            "Есть правки другого Google-аккаунта. Они сохранены в очереди.",
          );
          continue;
        }
        const claimed = await this.outbox.claim(row.id, this.clientId);
        if (!claimed) continue;
        try {
          if (row.operation.kind === "lanes")
            await this.repository.changeLanes(row.operation);
          else await this.repository.submit(row.operation);
          await this.outbox.acknowledge(row.id);
          this.bridge?.wake();
          this.channel?.postMessage("changed");
        } catch (error) {
          await this.outbox.release(row.id, this.clientId);
          throw error;
        }
      }
      this.queue = await this.outbox.list();
      if (generation === this.generation) {
        this.retryDelay=3000;
        if (hadWork) await this.refresh();
        this.state(
          this.conflicts.length
            ? "conflict"
            : this.pending()
              ? "pending"
              : "synced",
        );
      }
    } catch (error) {
      if(error.code==='resource-exhausted')this.retryDelay=Math.min(300000,Math.max(60000,this.retryDelay*2));
      if (generation === this.generation) this.state(error.code === "permission-denied" ? "access-denied" : "offline", error.message);
    } finally {
      this.busy = false;
      this.state(this.status, this.message);
      if (this.pending()) this.later(this.retryDelay);
    }
  }
  async resolve(choices, review = this.conflicts) {
    for (const [index, conflict] of review.entries()) {
      const result = await this.repository.resolve(conflict.id, {
        operationId: id(),
        choice: choices[index],
        expectedVersion: conflict.remoteVersion,
        actor: this.actor,
      });
      if (result.stale) {
        await this.refresh();
        return { stale: true };
      }
    }
    await this.refresh();
    this.state(
      this.conflicts.length
        ? "conflict"
        : this.pending()
          ? "pending"
          : "synced",
    );
    return { stale: false };
  }
  async disconnect() {
    this.generation++;
    this.connected = false;
    this.enabled = false;
    this.state(this.cacheInvalid ? "cache-error" : "signin");
    this.cancel(this.timer);
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.bridge?.stop();
    await this.repository?.disconnect();
    this.state(this.cacheInvalid ? "cache-error" : "signin");
  }
  resetBaseline() {
    throw new Error(
      "Общая история не сбрасывается на устройстве. Сохраните копию и обратитесь к владельцу доски.",
    );
  }
}
