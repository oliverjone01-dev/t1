import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import { TeamApi, digest } from "../public/team-api.mjs";
import { seedEntry, makeOperation } from "../public/team-model.mjs";
const BOARD = "1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY",
  PROJECT = "demo-task-canvas";
const task = {
  id: "team-acceptance",
  title: "Исходная",
  status: "В работе",
  owner: "Иван",
  due: "",
  priority: "do",
  positions: {},
};
const alice = { uid: "alice", name: "Алиса", clientId: "device-a" },
  bob = { uid: "bob", name: "Борис", clientId: "device-b" };
let env, a, b, ref;
const claims = (email) => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
});
const api = (who, email) =>
  new TeamApi({
    boardId: BOARD,
    sdk,
    db: env.authenticatedContext(who.uid, claims(email)).firestore(),
    user: { uid: who.uid },
  });
const op = (entry, title, id, actor = alice, more = {}) =>
  makeOperation(entry, { ...entry.task, title, ...more }, { id, actor });
before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      host: "127.0.0.1",
      port: 8188,
      rules: await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await sdk.setDoc(sdk.doc(db, "taskBoards", BOARD), {
      ready: true,
      sharingMode: "google-link",
      members: [],
    });
    await sdk.setDoc(sdk.doc(db, "taskCanvasAdmins", "alice@example.test"), {
      enabled: true,
    });
    await sdk.setDoc(sdk.doc(db, "taskBoards", BOARD, "meta", "lanes"), {
      items: [],
      revision: 1,
      lastOperationId: "seed",
    });
    await sdk.setDoc(
      sdk.doc(db, "taskBoards", BOARD, "tasks", await digest(task.id)),
      seedEntry(task),
    );
  });
  a = api(alice, "alice@example.test");
  b = api(bob, "bob@example.test");
  ref = await a.taskRef(task.id);
});
test("real server transactions merge different fields and retain immutable revision history", async () => {
  const entry = seedEntry(task),
    left = op(entry, "Название A", "op-title-alice"),
    right = makeOperation(
      entry,
      { ...entry.task, comment: "Комментарий B" },
      { id: "op-comment-bob", actor: bob },
    );
  const result = await Promise.all([a.submit(left), b.submit(right)]);
  assert.equal(result.flatMap((r) => r.conflictIds).length, 0);
  const current = (await sdk.getDoc(ref)).data();
  assert.equal(current.task.title, "Название A");
  assert.equal(current.task.comment, "Комментарий B");
  assert.equal(current.revision, 3);
  assert.equal((await a.history(task.id)).length, 2);
  await assertFails(
    sdk.updateDoc(ref, { revision: 4, "task.title": "Без истории" }),
  );
  await assertFails(sdk.deleteDoc(sdk.doc(ref, "versions", "2")));
});
test("50 simultaneous same-field requests retain every submitted value in current state or a conflict", async () => {
  const entry = seedEntry(task),
    requests = Array.from({ length: 50 }, (_, i) =>
      op(entry, "Вариант " + i, "stress-op-" + i, i % 2 ? alice : bob),
    );
  await Promise.all(
    requests.map((request) =>
      (request.actor.uid === "alice" ? a : b).submit(request),
    ),
  );
  const current = (await sdk.getDoc(ref)).data(),
    conflicts = await sdk.getDocs(
      sdk.collection(a.db, "taskBoards", BOARD, "conflicts"),
    );
  assert.equal(current.revision, 2);
  assert.equal(conflicts.size, 49);
  const retained = new Set([
    current.task.title,
    ...conflicts.docs.map((doc) => doc.data().local.title),
  ]);
  assert.equal(retained.size, 50);
  assert.ok(
    requests.every((request) => retained.has(request.groups.title.value.title)),
  );
});
test("lost acknowledgement is retried by operation ID without a second version", async () => {
  const request = op(seedEntry(task), "Одно изменение", "lost-response-op"),
    first = await a.submit(request),
    second = await a.submit(request);
  assert.deepEqual(first, second);
  assert.equal((await sdk.getDoc(ref)).data().revision, 2);
  assert.equal((await a.history(task.id)).length, 1);
  await assert.rejects(
    a.submit({ ...request, submittedAt: request.submittedAt + 1 }),
    /другую правку/,
  );
});
test("stale conflict resolution makes no write, then explicit refreshed choice succeeds", async () => {
  const initial = seedEntry(task);
  await a.submit(op(initial, "Версия A", "choose-first-a"));
  const reply = await b.submit(op(initial, "Версия B", "choose-other-b", bob)),
    conflictId = reply.conflictIds[0],
    conflict = (await sdk.getDoc(b.ref("conflicts", conflictId))).data();
  const beforeThird = (await sdk.getDoc(ref)).data();
  await a.submit(op(beforeThird, "Версия C", "choose-third-c"));
  const stale = await b.resolve(conflictId, {
    operationId: "choose-stale-b",
    choice: "local",
    expectedVersion: conflict.remoteVersion,
    actor: bob,
  });
  assert.equal(stale.stale, true);
  assert.equal((await sdk.getDoc(ref)).data().task.title, "Версия C");
  assert.equal(
    (await sdk.getDoc(b.ref("conflicts", conflictId))).data().status,
    "open",
  );
  const current = (await sdk.getDoc(ref)).data();
  await b.resolve(conflictId, {
    operationId: "choose-refresh-b",
    choice: "local",
    expectedVersion: current.versions.title,
    actor: bob,
  });
  assert.equal((await sdk.getDoc(ref)).data().task.title, "Версия B");
  assert.equal(
    (await sdk.getDoc(b.ref("conflicts", conflictId))).data().status,
    "resolved",
  );
  await assertFails(
    sdk.updateDoc(b.ref("conflicts", conflictId), {
      local: { title: "Скрыть альтернативу" },
    }),
  );
});
test("authentication, fixed board and shared membership are enforced at the server", async () => {
  const anonymous = env.unauthenticatedContext().firestore();
  await assertFails(sdk.getDoc(sdk.doc(anonymous, "taskBoards", BOARD)));
  const wrongProvider = env
    .authenticatedContext("mallory", {
      email: "m@example.test",
      email_verified: true,
      firebase: { sign_in_provider: "anonymous" },
    })
    .firestore();
  await assertFails(sdk.getDoc(sdk.doc(wrongProvider, "taskBoards", BOARD)));
  await assertSucceeds(
    sdk.updateDoc(a.root(), {
      sharingMode: "members",
      members: ["alice@example.test"],
    }),
  );
  await assertFails(sdk.getDoc(b.root()));
  await assertFails(sdk.updateDoc(b.root(), { sharingMode: "google-link" }));
  await assertFails(
    sdk.getDoc(sdk.doc(b.db, "taskBoards", "another-board", "tasks", "x")),
  );
});
test("one bridge lease gates source checkpoints without permitting business overwrite", async () => {
  assert.equal(await a.acquireBridge("device-a"), true);
  assert.equal(await b.acquireBridge("device-b"), false);
  await assertFails(
    sdk.updateDoc(ref, {
      sheet: {
        present: true,
        task,
        versions: {},
        revision: 1,
        observer: "device-b",
      },
      sheetAck: "bad",
    }),
  );
  await a.markSheetObserved(
    [
      {
        id: task.id,
        present: true,
        task,
        versions: seedEntry(task).versions,
        revision: 1,
      },
    ],
    "device-a",
  );
  assert.equal((await sdk.getDoc(ref)).data().sheet.observer, "device-a");
  await a.releaseBridge("device-a");
  assert.equal(await b.acquireBridge("device-b"), true);
});

test("Sheets bridge imports external fields conditionally and projects team fields without losing alternatives", async () => {
  const { TeamSourceBridge } = await import("../public/team-source.mjs");
  const initial = seedEntry(task);
  await env.withSecurityRulesDisabled(async (c) =>
    sdk.updateDoc(sdk.doc(c.firestore(), ref.path), {
      sheet: {
        present: true,
        task: initial.task,
        versions: initial.versions,
        revision: 1,
        lifeVersion: initial.lifeVersion,
        observer: "seed",
      },
      sheetAck: "seed",
    }),
  );
  await a.submit(op(initial, "Версия команды", "source-team-title"));
  let source = {
    records: [
      {
        id: task.id,
        task: {
          ...initial.task,
          title: "Версия таблицы",
          comment: "Из таблицы",
        },
        archived: false,
        row: 3,
      },
    ],
    board: { tasks: [], owners: [] },
  };
  source.board.tasks = source.records.map((r) => r.task);
  let writes = 0;
  const remote = await a.read(),
    engine = {
      repository: a,
      clientId: "device-a",
      actor: alice,
      entries: new Map(remote.entries.map((e) => [e.task.id, e])),
      owners: [],
      rawConflicts: [],
      connected: true,
      sourceState: {},
      status: "synced",
      state: () => {},
      api: {
        read: async () => structuredClone(source),
        write: async (snapshot, changes, owners) => {
          writes++;
          for (const change of changes) {
            const row = source.records.find((r) => r.id === change.id);
            if (change.type === "patch")
              for (const field of change.fields)
                row.task[field] = change.task[field];
            else if (change.type === "archive") row.archived = true;
            else
              source.records.push({
                id: change.id,
                task: change.task,
                archived: false,
              });
          }
          source.board = {
            tasks: source.records.filter((r) => !r.archived).map((r) => r.task),
            owners,
          };
        },
      },
    };
  const bridge = new TeamSourceBridge(engine);
  bridge.running = true;
  try {
    await bridge.tick();
    const next = await a.read();
    assert.equal(next.entries[0].task.title, "Версия команды");
    assert.equal(next.entries[0].task.comment, "Из таблицы");
    assert.equal(next.conflicts.length, 1);
    assert.equal(source.records[0].task.title, "Версия таблицы");
    assert.equal(engine.sourceState.status, "synced");
    const conflict = next.conflicts[0];
    await a.resolve(conflict.id, {
      operationId: "source-choose-team",
      choice: "remote",
      expectedVersion: next.entries[0].versions.title,
      actor: alice,
    });
    const chosen = await a.read();
    engine.entries = new Map(chosen.entries.map((e) => [e.task.id, e]));
    engine.rawConflicts = chosen.conflicts;
    await bridge.tick();
    assert.equal(source.records[0].task.title, "Версия команды");
    assert.equal(writes, 1);
  } finally {
    await bridge.stop();
  }
});

test("a lost Sheet append response cannot overwrite the next manual edit of that new card", async () => {
  const { TeamSourceBridge } = await import("../public/team-source.mjs");
  let source = { records: [], board: { tasks: [], owners: [] } },
    writes = 0;
  const remote = await a.read(),
    engine = {
      repository: a,
      clientId: "device-a",
      actor: alice,
      entries: new Map(remote.entries.map((e) => [e.task.id, e])),
      owners: [],
      rawConflicts: [],
      connected: true,
      sourceState: {},
      status: "synced",
      state: () => {},
      api: {
        read: async () => structuredClone(source),
        write: async (snapshot, changes, owners) => {
          writes++;
          source.records = changes
            .filter((c) => c.type === "upsert")
            .map((c) => ({
              id: c.id,
              task: { ...c.task, sourceId: "sheet-generated" },
              archived: false,
              row: 3,
            }));
          source.board = { tasks: source.records.map((r) => r.task), owners };
          throw new Error("Lost append response");
        },
      },
    };
  const bridge = new TeamSourceBridge(engine);
  bridge.running = true;
  try {
    await bridge.tick();
    assert.equal(writes, 1);
    const checkpoint = (await a.read()).entries[0];
    assert.equal(checkpoint.sheet.present, false);
    source.records[0].task.title = "Ручная правка после потерянного ответа";
    source.board.tasks = source.records.map((r) => r.task);
    const latest = await a.read();
    engine.entries = new Map(latest.entries.map((e) => [e.task.id, e]));
    engine.rawConflicts = latest.conflicts;
    await bridge.tick();
    const final = await a.read();
    assert.equal(final.entries[0].task.title, task.title);
    assert.equal(final.conflicts.length, 1);
    assert.equal(
      final.conflicts[0].local.task.title,
      "Ручная правка после потерянного ответа",
    );
    assert.equal(
      source.records[0].task.title,
      "Ручная правка после потерянного ответа",
    );
    assert.equal(writes, 1);
  } finally {
    await bridge.stop();
  }
});
