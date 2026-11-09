import {
  applyOperation,
  validateEntry,
  validateOperation,
  resolveConflict,
  GROUPS,
  GROUP_NAMES,
} from "./team-model.mjs?rev=20261109-gantt-1";
import { equal } from "./sync-model.mjs?rev=20261109-gantt-1";
export const digest = async (value) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          typeof value === "string" ? value : JSON.stringify(value),
        ),
      ),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const safeError = (error) => {
  if (error?.code === "permission-denied")
    return Object.assign(new Error("Этот Google-аккаунт не входит в команду. Попросите владельца добавить ваш адрес в разделе «Доступ». Неотправленные правки сохранены на устройстве."), {code:"permission-denied"});
  if (error?.code === "resource-exhausted")
    return Object.assign(new Error("Достигнут лимит Google. Изменения остались в очереди; повторим отправку позже."),{code:"resource-exhausted"});
  return error;
};
export async function firebaseSdk() {
  const [app, auth, firestore] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js"),
  ]);
  return { ...app, ...auth, ...firestore };
}
export class TeamApi {
  constructor({ config, boardId, sdk = null, db = null, user = null }) {
    this.config = config;
    this.boardId = boardId;
    this.sdk = sdk;
    this.db = db;
    this.user = user;
    this.listeners = [];
  }
  async authenticate(accessToken) {
    const generation = (this.authGeneration = (this.authGeneration || 0) + 1);
    const work = async () => {
      const s = (this.sdk ??= await firebaseSdk());
      if (generation !== this.authGeneration)
        throw new Error("Подключение отменено.");
      if (!this.app) {
        this.app = s.initializeApp(this.config, "task-canvas-team");
        this.auth = s.initializeAuth(this.app, {
          persistence: s.inMemoryPersistence,
        });
        this.db = s.initializeFirestore(this.app, {
          localCache: s.memoryLocalCache(),
          experimentalAutoDetectLongPolling: true,
        });
      }
      const session = await s.signInWithCredential(
        this.auth,
        s.GoogleAuthProvider.credential(null, accessToken),
      );
      if (generation !== this.authGeneration) {
        await s.signOut(this.auth);
        throw new Error("Подключение отменено.");
      }
      this.user = session.user;
      return this.actor();
    };
    this.authChain = (this.authChain || Promise.resolve())
      .catch(() => {})
      .then(work);
    return this.authChain;
  }
  publicRef(collection, id) {
    return this.sdk.doc(
      this.db,
      "taskBoardViews",
      this.boardId,
      collection,
      id,
    );
  }
  actor(clientId = "") {
    return {
      uid: this.user.uid,
      name: this.user.displayName || "Участник команды",
      email: this.user.email || "",
      clientId,
    };
  }
  root() {
    return this.sdk.doc(this.db, "taskBoards", this.boardId);
  }
  ref(collection, id) {
    return this.sdk.doc(this.db, "taskBoards", this.boardId, collection, id);
  }
  async accessInfo() {
    try { const doc=await this.sdk.getDocFromServer(this.root());return doc.data(); }
    catch(error){throw safeError(error)}
  }
  async setMember(email, enabled, operationId=crypto.randomUUID()) {
    email=String(email).trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) throw new Error("Укажите корректный Google-адрес.");
    const s=this.sdk, event=this.ref("accessEvents",operationId), actor=this.actor();
    return this.transact(async tx=>{
      const [root,receipt]=await Promise.all([tx.get(this.root()),tx.get(event)]);
      if(receipt.exists()) {
        if(receipt.data().email!==email || receipt.data().enabled!==enabled) throw new Error("Этот ID уже использован для другого изменения доступа.");
        return root.data();
      }
      const data=root.data();
      if(data.ownerEmail!==actor.email.toLowerCase()) throw new Error("Управлять доступом может только владелец доски.");
      if(email===data.ownerEmail) throw new Error("Доступ владельца сохраняется постоянно.");
      const members=new Set(data.members||[]);
      enabled ? members.add(email) : members.delete(email);
      if(members.size>200) throw new Error("В списке может быть до 200 редакторов.");
      const after=[...members].sort(), revision=data.accessRevision+1;
      tx.update(this.root(),{members:after,accessRevision:revision,lastAccessEvent:operationId});
      tx.set(event,{email,enabled,before:data.members,after,revision,actor,createdAt:s.serverTimestamp()});
      return {...data,members:after,accessRevision:revision};
    },this.root(),"accessRevision").catch(error=>{throw safeError(error)});
  }
  async taskRef(id) {
    return this.ref("tasks", await digest(id));
  }
  async read() {
    const s = this.sdk;
    const [root, tasks, lanes, conflicts, source] = await Promise.all([
      s.getDoc(this.root()),
      s.getDocs(s.collection(this.db, "taskBoards", this.boardId, "tasks")),
      s.getDoc(this.ref("meta", "lanes")),
      s.getDocs(
        s.query(
          s.collection(this.db, "taskBoards", this.boardId, "conflicts"),
          s.where("status", "==", "open"),
        ),
      ),
      s.getDoc(this.ref("meta", "source")),
    ]);
    if (!root.exists() || !root.data().ready)
      throw new Error(
        "Командная доска ещё не подготовлена. Локальные задачи сохранены.",
      );
    return {
      entries: tasks.docs.map((d) => validateEntry(d.data())),
      lanes: lanes.exists() ? lanes.data() : { items: [], revision: 0 },
      conflicts: conflicts.docs.map((d) => ({ ...d.data(), id: d.id })),
      root: root.data(),
      source: source.exists()
        ? source.data()
        : { status: "pending", checkedAt: 0 },
    };
  }
  subscribe(onData, onError) {
    const s = this.sdk,
      state = {};
    const caches = {};
    const emit = () => {
      if (state.entries && state.lanes && state.conflicts && state.root) {
        onData({ ...state, fromCache: Object.values(caches).some(Boolean) });
      }
    };
    const watch = (ref, key, convert) =>
      this.listeners.push(
        s.onSnapshot(
          ref,
          { includeMetadataChanges: true },
          (snapshot) => {
            state[key] = convert(snapshot);
            caches[key] = snapshot.metadata.fromCache;
            emit();
          },
          (error) => onError(safeError(error)),
        ),
      );
    watch(this.root(), "root", (d) => (d.exists() ? d.data() : null));
    watch(
      s.collection(this.db, "taskBoards", this.boardId, "tasks"),
      "entries",
      (d) => d.docs.map((row) => validateEntry(row.data())),
    );
    watch(this.ref("meta", "lanes"), "lanes", (d) =>
      d.exists() ? d.data() : { items: [], revision: 0 },
    );
    watch(
      s.query(
        s.collection(this.db, "taskBoards", this.boardId, "conflicts"),
        s.where("status", "==", "open"),
      ),
      "conflicts",
      (d) => d.docs.map((row) => ({ ...row.data(), id: row.id })),
    );
    watch(this.ref("meta", "source"), "source", (d) =>
      d.exists() ? d.data() : { status: "pending", checkedAt: 0 },
    );
    return () => {
      this.listeners.splice(0).forEach((unsubscribe) => unsubscribe());
    };
  }
  checkActor(op) {
    if (!this.user || op.actor.uid !== this.user.uid)
      throw new Error(
        "Неотправленная правка принадлежит другому Google-аккаунту. Войдите в него, чтобы продолжить.",
      );
  }
  writeRevision(tx, taskRef, before, after, op) {
    const s = this.sdk;
    const view = this.publicRef("tasks", taskRef.id);
    if (after.archived) tx.delete(view);
    else
      tx.set(view, { schema: 1, revision: after.revision, task: after.task });
    tx.set(taskRef, {
      ...after,
      updatedAt: s.serverTimestamp(),
      actor: op.actor,
    });
    tx.set(s.doc(taskRef, "versions", String(after.revision)), {
      schema: 1,
      taskId: op.taskId,
      revision: after.revision,
      before: before
        ? {
            task: before.task,
            archived: before.archived,
            versions: before.versions,
          }
        : null,
      after: {
        task: after.task,
        archived: after.archived,
        versions: after.versions,
      },
      operationId: op.id,
      actor: op.actor,
      createdAt: s.serverTimestamp(),
    });
  }
  async transact(work, watchedRef, revisionField="revision") {
    let observed = watchedRef
      ? (await this.sdk.getDoc(watchedRef)).data()?.[revisionField]
      : null;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.sdk.runTransaction(this.db, work);
      } catch (error) {
        if (
          attempt >= 7 ||
          !["aborted", "permission-denied"].includes(error.code)
        )
          throw error;
        // A concurrent immutable history create can fail rules before the SDK sees
        // the stale precondition. Retry only after a readable newer task revision.
        if (error.code === "permission-denied") {
          if (!watchedRef) throw error;
          const current = (await this.sdk.getDocFromServer(watchedRef)).data()?.[revisionField];
          if (current === observed) throw error;
          observed = current;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 30 + Math.random() * 150),
        );
      }
    }
  }
  async submit(input) {
    const op = validateOperation(input);
    this.checkActor(op);
    const s = this.sdk,
      taskRef = await this.taskRef(op.taskId),
      receipt = this.ref("operations", op.id),
      hash = await digest(op);
    try {
      return await this.transact(async (tx) => {
        const seen = await tx.get(receipt);
        if (seen.exists()) {
          if (seen.data().digest !== hash)
            throw new Error(
              "Повторный ID содержит другую правку. Исходная операция сохранена.",
            );
          return seen.data().result;
        }
        const doc = await tx.get(taskRef),
          before = doc.exists() ? validateEntry(doc.data()) : null,
          result = applyOperation(before, op);
        if (result.changed)
          this.writeRevision(tx, taskRef, before, result.entry, op);
        for (const conflict of result.conflicts)
          tx.set(this.ref("conflicts", conflict.id), {
            ...conflict,
            title: op.task?.title || before?.task.title || op.taskId,
            taskKey: taskRef.id,
            createdAt: s.serverTimestamp(),
          });
        const acknowledgement = {
          changed: result.changed,
          conflictIds: result.conflicts.map((c) => c.id),
          revision: result.entry?.revision || 0,
        };
        tx.set(receipt, {
          protocol: 3,
          schema: 1,
          digest: hash,
          taskId: op.taskId,
          actor: op.actor,
          request: op,
          result: acknowledgement,
          createdAt: s.serverTimestamp(),
        });
        return acknowledgement;
      }, taskRef);
    } catch (error) {
      throw safeError(error);
    }
  }
  async resolve(id, { operationId, choice, expectedVersion, actor }) {
    const s = this.sdk,
      ref = this.ref("conflicts", id),
      receipt = this.ref("operations", operationId);
    this.checkActor({ actor });
    const hash = await digest({ id, choice, expectedVersion, actor });
    try {
      return await s.runTransaction(this.db, async (tx) => {
        const [seen, conflictDoc] = await Promise.all([
          tx.get(receipt),
          tx.get(ref),
        ]);
        if (seen.exists()) {
          if (seen.data().digest !== hash)
            throw new Error("Повторный ID содержит другой выбор.");
          return seen.data().result;
        }
        if (!conflictDoc.exists()) throw new Error("Конфликт не найден.");
        const conflict = conflictDoc.data(),
          taskRef = await this.taskRef(conflict.taskId),
          doc = await tx.get(taskRef),
          before = doc.exists() ? validateEntry(doc.data()) : null;
        const result = resolveConflict(before, conflict, {
          id: operationId,
          choice,
          expectedVersion,
          actor,
        });
        if (result.stale) return result;
        if (result.changed)
          this.writeRevision(tx, taskRef, before, result.entry, {
            id: operationId,
            taskId: conflict.taskId,
            actor,
          });
        const acknowledgement = {
          changed: result.changed,
          conflictIds: [],
          revision: result.entry?.revision || 0,
        };
        if (conflict.status === "open")
          tx.update(ref, {
            status: "resolved",
            resolution: result.resolution || {
              choice: "already-resolved",
              actor,
              operationId,
            },
            resolvedAt: s.serverTimestamp(),
          });
        tx.set(receipt, {
          protocol: 3,
          schema: 1,
          digest: hash,
          taskId: conflict.taskId,
          actor,
          request: { kind: "resolve", conflictId: id, choice, expectedVersion },
          result: acknowledgement,
          createdAt: s.serverTimestamp(),
        });
        return acknowledgement;
      });
    } catch (error) {
      throw safeError(error);
    }
  }
  async changeLanes(op) {
    this.checkActor(op);
    const s = this.sdk,
      ref = this.ref("meta", "lanes"),
      receipt = this.ref("operations", op.id),
      hash = await digest(op);
    return s.runTransaction(this.db, async (tx) => {
      const [seen, doc] = await Promise.all([tx.get(receipt), tx.get(ref)]);
      if (seen.exists()) {
        if (seen.data().digest !== hash)
          throw new Error("Повторный ID содержит другие дорожки.");
        return seen.data().result;
      }
      const before = doc.exists() ? doc.data() : { items: [], revision: 0 };
      const items = [
        ...new Set([
          ...(before.items || []).filter((name) => !op.remove.includes(name)),
          ...op.add,
        ]),
      ].sort();
      const changed = !equal(items, [...before.items].sort()),
        revision = before.revision + (changed ? 1 : 0);
      if (changed) {
        tx.set(this.publicRef("meta", "lanes"), { items, revision });
        tx.set(ref, {
          items,
          revision,
          lastOperationId: op.id,
          updatedAt: s.serverTimestamp(),
        });
        tx.set(this.ref("laneVersions", String(revision)), {
          before: before.items,
          after: items,
          revision,
          operationId: op.id,
          actor: op.actor,
          createdAt: s.serverTimestamp(),
        });
      }
      const ack = { changed, revision, conflictIds: [] };
      tx.set(receipt, {
        protocol: 3,
        schema: 1,
        digest: hash,
        taskId: "__lanes",
        actor: op.actor,
        request: op,
        result: ack,
        createdAt: s.serverTimestamp(),
      });
      return ack;
    });
  }
  async history(taskId, count = 20) {
    const s = this.sdk,
      ref = await this.taskRef(taskId),
      rows = await s.getDocs(
        s.query(
          s.collection(ref, "versions"),
          s.orderBy("revision", "desc"),
          s.limit(count),
        ),
      );
    return rows.docs.map((d) => d.data());
  }
  async acquireBridge(clientId) {
    const s = this.sdk,
      ref = this.ref("meta", "bridgeLease");
    try {
      return await s.runTransaction(this.db, async (tx) => {
        const doc = await tx.get(ref),
          lease = doc.exists() ? doc.data() : null;
        if (
          lease &&
          lease.protocol === 3 &&
          lease.holder !== clientId &&
          Date.now() - (lease.acquiredAt?.toMillis?.() || 0) < 120000
        )
          return false;
        tx.set(ref, {
          holder: clientId,
          protocol: 3,
          uid: this.user.uid,
          acquiredAt: s.serverTimestamp(),
        });
        return true;
      });
    } catch (error) {
      if (error.code === "permission-denied") return false;
      throw error;
    }
  }
  async releaseBridge(clientId) {
    const s = this.sdk,
      ref = this.ref("meta", "bridgeLease");
    return s.runTransaction(this.db, async (tx) => {
      const doc = await tx.get(ref);
      if (doc.exists() && doc.data().holder === clientId) tx.delete(ref);
    });
  }
  async markSheetObserved(entries, clientId) {
    const s = this.sdk;
    for (const chunk of Array.from(
      { length: Math.ceil(entries.length / 5) },
      (_, i) => entries.slice(i * 5, i * 5 + 5),
    )) {
      await s.runTransaction(this.db, async (tx) => {
        const lease = await tx.get(this.ref("meta", "bridgeLease"));
        if (!lease.exists() || lease.data().holder !== clientId)
          throw new Error("Связь с таблицей передана другой вкладке.");
        const rows = await Promise.all(
          chunk.map(async (row) => {
            const ref = await this.taskRef(row.id),
              doc = await tx.get(ref);
            return { ref, doc, row };
          }),
        );
        for (const { ref, doc, row } of rows)
          if (doc.exists()) {
            const current = validateEntry(doc.data());
            tx.update(ref, {
              sheet: {
                present: row.present,
                task: row.task,
                versions: row.versions,
                revision: row.revision,
                lifeVersion: row.lifeVersion || current.lifeVersion,
                checkedAt: Date.now(),
                observer: clientId,
              },
              sheetAck: row.acknowledgedVersion || "",
            });
          }
      });
    }
  }
  async sourceState(status, message = "", checkedAt = Date.now()) {
    const batch = this.sdk.writeBatch(this.db);
    batch.set(
      this.ref("meta", "source"),
      { status, message, checkedAt },
      { merge: true },
    );
    batch.set(this.publicRef("meta", "source"), { status, checkedAt });
    await batch.commit();
  }
  async disconnect() {
    this.authGeneration = (this.authGeneration || 0) + 1;
    this.user = null;
    this.listeners.splice(0).forEach((fn) => fn());
    this.authChain = (this.authChain || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        if (this.auth) await this.sdk.signOut(this.auth);
      });
    return this.authChain;
  }
}
