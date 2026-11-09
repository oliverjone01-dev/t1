import {
  makeOperation,
  seedEntry,
  GROUPS,
  groupValue,
  toBoard,
} from "./team-model.mjs?rev=20261110-priority-3";
import {
  equal,
  mergeBoards,
  comparable,
} from "./sync-model.mjs?rev=20261110-priority-3";
import { digest } from "./team-api.mjs?rev=20261110-priority-3";
const clone = (value) => structuredClone(value);
function copyGroup(target, source, group) {
  for (const path of GROUPS[group]) {
    const keys = path.split("."),
      last = keys.pop();
    let to = target,
      from = source;
    for (const key of keys) {
      to = to[key] ??= {};
      from = from?.[key];
    }
    if (from?.[last] === undefined) delete to[last];
    else to[last] = clone(from[last]);
  }
}
export class TeamSourceBridge {
  constructor(engine,{now=()=>Date.now()}={}) {
    this.engine = engine;
    this.now=now;
    this.lastPublishedAt=0;
    this.lastPublishedStatus=null;
    this.retryDelay=30000;
    this.running = false;
    this.busy = false;
    this.generation = 0;
  }
  start() {
    if(this.engine.accessRoot?.background?.enabled)return;
    if(this.engine.accessRoot?.ownerEmail && this.engine.actor.email?.toLowerCase()!==this.engine.accessRoot.ownerEmail)return;
    this.running = true;
    this.generation++;
    this.later(0);
  }
  stop() {
    this.running = false;
    this.generation++;
    clearTimeout(this.timer);
    if (this.engine.repository?.user)
      return this.engine.repository
        .releaseBridge(this.engine.clientId)
        .catch(() => {});
  }
  later(delay = 30000) {
    clearTimeout(this.timer);
    if (this.running) this.timer = setTimeout(() => this.tick(), delay);
  }
  wake() {
    if (!this.busy) this.later(800);
  }
  async tick() {
    const e = this.engine,
      generation = this.generation;
    if(e.accessRoot?.background?.enabled){this.running=false;return;}
    if (!this.running || this.busy || !e.connected) return;
    this.busy = true;
    const active = () => {
      if (!this.running || generation !== this.generation || !e.connected)
        throw new Error("Связь с таблицей остановлена.");
    };
    const checkpoint = (entry, record) => ({
      id: entry.task.id,
      present: !!record && !record.archived,
      task: clone(record?.task || entry.task),
      versions: clone(entry.versions),
      revision: entry.revision,
      lifeVersion: entry.lifeVersion,
      acknowledgedVersion: entry.lastOperationId,
    });
    try {
      if (!(await e.repository.acquireBridge(e.clientId))) return;
      active();
      const before = {
        entries: [...e.entries.values()].map(clone),
        lanes: { items: [...e.owners] },
        conflicts: clone(e.rawConflicts),
      };
      let source = await e.api.read();
      active();
      if(e.api.ensureTeamProtocol){await e.api.ensureTeamProtocol(source);active();}
      const records = new Map(source.records.map((row) => [row.id, row])),
        current = new Map(before.entries.map((row) => [row.task.id, row]));
      const observed = [];
      for (const entry of before.entries) {
        const row = records.get(entry.task.id),
          old = entry.sheet;
        if (!old) {
          if (row) {
            const options = {
              id: "source-pending",
              actor: e.actor,
              submittedAt: 0,
              includeContext: true,
            };
            let operation;
            if (row.archived) {
              operation = entry.archived
                ? null
                : makeOperation(entry, null, options);
              if (operation) operation.baseRevision = 0;
            } else if (
              !entry.archived &&
              equal(comparable(entry.task), comparable(row.task))
            )
              operation = makeOperation(entry, row.task, options);
            else
              operation = {
                schema: 1,
                id: "source-pending",
                kind: "create",
                taskId: row.id,
                task: row.task,
                actor: e.actor,
                submittedAt: 0,
              };
            if (operation) {
              operation.id =
                "source-" + (await digest({ ...operation, id: undefined }));
              await e.repository.submit(operation);
            }
            observed.push({ entry, row });
          }
          continue;
        }
        const present = !!row && !row.archived;
        if (old.present === present && (!present || equal(old.task, row.task)))
          continue;
        const base = {
          ...entry,
          task: old.task,
          versions: old.versions,
          revision: old.revision,
          lifeVersion: old.lifeVersion || entry.lifeVersion,
          archived: !old.present && entry.archived,
        };
        let operation = makeOperation(base, present ? row.task : null, {
          id: "source-pending",
          actor: e.actor,
          submittedAt: 0,
          includeContext: true,
        });
        if (
          present &&
          !old.present &&
          !equal(comparable(entry.task), comparable(row.task))
        )
          operation = {
            schema: 1,
            id: "source-pending",
            kind: "create",
            taskId: row.id,
            task: row.task,
            actor: e.actor,
            submittedAt: 0,
          };
        if (operation) {
          operation.id =
            "source-" + (await digest({ ...operation, id: undefined }));
          await e.repository.submit(operation);
        }
        observed.push({ entry, row });
        active();
      }
      for (const row of source.records)
        if (!current.has(row.id)) {
          const operation = {
            schema: 1,
            id: "source-pending",
            kind: "create",
            taskId: row.id,
            task: row.task,
            actor: e.actor,
            submittedAt: 0,
          };
          operation.id =
            "source-" + (await digest({ ...operation, id: undefined }));
          await e.repository.submit(operation);
          if (row.archived) {
            const archive = makeOperation(
              seedEntry(row.task, operation.id),
              null,
              { id: operation.id + "a", actor: e.actor, submittedAt: 0 },
            );
            await e.repository.submit(archive);
          }
          observed.push({ entry: seedEntry(row.task), row });
          active();
        }
      let canonical = observed.length ? await e.repository.read() : before;
      active();
      if (observed.length) {
        const byId = new Map(
          canonical.entries.map((row) => [row.task.id, row]),
        );
        await e.repository.markSheetObserved(
          observed.map(({ entry, row }) => {
            const latest = byId.get(entry.task.id) || entry,
              result = checkpoint(latest, row);
            if (row && entry.sheet)
              for (const group of Object.keys(GROUPS))
                if (
                  !equal(
                    groupValue(row.task, group),
                    groupValue(latest.task, group),
                  )
                )
                  result.versions[group] = entry.sheet.versions[group];
            if (latest.archived !== !result.present) {
              result.revision = entry.sheet?.revision || entry.revision;
              result.lifeVersion =
                entry.sheet?.lifeVersion || entry.lifeVersion;
            }
            return result;
          }),
          e.clientId,
        );
      }
      const newOwners = source.board.owners.filter(
        (name) => !canonical.lanes.items.includes(name),
      );
      if (newOwners.length)
        await e.repository.changeLanes({
          schema: 1,
          id: crypto.randomUUID(),
          kind: "lanes",
          taskId: "__lanes",
          actor: e.actor,
          add: newOwners,
          remove: [],
          submittedAt: Date.now(),
        });
      // Unresolved source alternatives stay visible in Sheets until somebody chooses.
      const projected = canonical.entries.map(clone),
        byId = new Map(projected.map((row) => [row.task.id, row]));
      for (const conflict of canonical.conflicts) {
        if (!String(conflict.operationId).startsWith("source-")) continue;
        const entry = byId.get(conflict.taskId),
          row = records.get(conflict.taskId);
        if (!entry) continue;
        if (conflict.group === "task") {
          entry.archived = !row || row.archived;
          if (row) entry.task = clone(row.task);
        } else if (row) copyGroup(entry.task, row.task, conflict.group);
      }
      const target = toBoard(projected, canonical.lanes.items),
        plan = mergeBoards(source.board, target, source.board);
      // Record observed absence before append, so a lost Sheets response cannot
      // turn a subsequently edited row into an unobserved blind overwrite.
      const unobserved = canonical.entries.filter(
        (entry) => !entry.sheet && !records.has(entry.task.id),
      );
      if (unobserved.length)
        await e.repository.markSheetObserved(
          unobserved.map((entry) => checkpoint(entry, null)),
          e.clientId,
        );
      if (plan.writes.length || !equal(source.board.owners, target.owners)) {
        active();
        if (!(await e.repository.acquireBridge(e.clientId))) return;
        active();
        await e.api.write(source, plan.writes, target.owners);
        active();
        source = await e.api.read();
        active();
      }
      const actual = new Map(source.records.map((row) => [row.id, row])),
        acks = [];
      for (const entry of canonical.entries) {
        const row = actual.get(entry.task.id),
          present = !!row && !row.archived;
        if (
          entry.archived !== !present ||
          (present && !equal(comparable(entry.task), comparable(row.task)))
        )
          continue;
        const saved = entry.sheet;
        if (
          saved?.present === present &&
          saved?.revision === entry.revision &&
          equal(saved?.task, row?.task || entry.task)
        )
          continue;
        const ack = checkpoint(entry, row);
        // Sheets-generated context is imported on the next versioned read.
        ack.task = clone(entry.task);
        acks.push(ack);
      }
      if (acks.length) await e.repository.markSheetObserved(acks, e.clientId);
      active();
      const checkedAt=this.now();
      e.sourceState = { status: "synced", checkedAt, message: "" };
      // Business changes still publish immediately. An unchanged Sheet poll
      // needs a heartbeat only every five minutes, rather than two writes and
      // a public notification on every 30-second read.
      if(observed.length||acks.length||plan.writes.length||newOwners.length||this.lastPublishedStatus!=="synced"||checkedAt-this.lastPublishedAt>=300000){
        await e.repository.sourceState("synced","",checkedAt);
        this.lastPublishedAt=checkedAt;this.lastPublishedStatus="synced";
      }
      this.retryDelay=30000;
      e.state(e.status, e.message);
    } catch (error) {
      if (generation !== this.generation) return;
      e.sourceState = {
        status: error.auth ? "signin" : "offline",
        message: error.message,
        checkedAt: e.sourceState.checkedAt || 0,
      };
      e.state(e.status, e.message);
      if(error.code==='resource-exhausted')this.retryDelay=Math.min(300000,this.retryDelay*2);
      // A quota refusal cannot be reported through another write to that quota.
      if(error.code!=='resource-exhausted' && (this.lastPublishedStatus!==e.sourceState.status || this.now()-this.lastPublishedAt>=300000)){
        try {
          await e.repository.sourceState(e.sourceState.status,error.message,e.sourceState.checkedAt);
          this.lastPublishedAt=this.now();this.lastPublishedStatus=e.sourceState.status;
        } catch {}
      }
    } finally {
      this.busy = false;
      this.later(this.retryDelay);
    }
  }
}
