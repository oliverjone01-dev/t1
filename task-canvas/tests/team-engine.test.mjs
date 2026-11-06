import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { TeamSyncEngine } from "../public/team-engine.mjs";
import { TeamOutbox } from "../public/team-outbox.mjs";
import {
  seedEntry,
  applyOperation,
  makeOperation,
} from "../public/team-model.mjs";
const task = {
  id: "card",
  title: "Исходная",
  comment: "",
  owner: "",
  due: "",
  positions: {},
  status: "В работе",
  priority: null,
};
const fixture = () => {
  let board = { tasks: [task], owners: [] };
  const outbox = new TeamOutbox(new IDBFactory(), { namespace: "test" }),
    engine = new TeamSyncEngine({
      boardId: "test",
      cache: { version: 2, entries: [seedEntry(task)], owners: [] },
      outbox,
      getLocal: () => board,
      apply: (value) => (board = value),
      onState: () => {},
      schedule: () => 0,
      cancel: () => {},
    });
  return { engine, outbox, board: () => board };
};
test("offline intents are durable, causally ordered and survive engine reload", async () => {
  const f = fixture();
  await f.engine.ready();
  let basis = f.engine.capture();
  await f.engine.changed({
    basis,
    desired: { tasks: [{ ...task, title: "Первое" }], owners: [] },
  });
  basis = f.engine.capture();
  await f.engine.changed({
    basis,
    desired: {
      tasks: [{ ...f.board().tasks[0], title: "Второе" }],
      owners: [],
    },
  });
  const queued = await f.outbox.list();
  assert.equal(queued.length, 2);
  assert.equal(queued[1].operation.groups.title.baseVersion, queued[0].id);
  let entry = seedEntry(task);
  for (const row of queued) {
    const result = applyOperation(entry, row.operation);
    assert.equal(result.conflicts.length, 0);
    entry = result.entry;
  }
  assert.equal(entry.task.title, "Второе");
  const restored = new TeamSyncEngine({
    boardId: "test",
    cache: f.engine.snapshot(),
    outbox: f.outbox,
    getLocal: f.board,
    apply: () => {},
    onState: () => {},
  });
  await restored.ready();
  assert.equal(restored.capture().entries.get("card").task.title, "Второе");
});
test("failed durable queue keeps canonical state and reports failure instead of pretending to save", async () => {
  const f = fixture();
  await f.engine.ready();
  f.outbox.addMany = async () => {
    throw new Error("quota");
  };
  await assert.rejects(
    f.engine.changed({
      basis: f.engine.capture(),
      desired: { tasks: [{ ...task, title: "Не подтверждено" }], owners: [] },
    }),
    /безопасную очередь/,
  );
  assert.equal(f.board().tasks[0].title, "Исходная");
  assert.equal(f.engine.pending(), 0);
});
test("editor opening versions detect ABA while untouched fields keep the latest team value", async () => {
  const f = fixture();
  await f.engine.ready();
  const opened = f.engine.capture();
  let entry = seedEntry(task);
  entry = applyOperation(
    entry,
    makeOperation(
      entry,
      { ...entry.task, title: "Другой" },
      { id: "other-edit-1", actor: { uid: "b", name: "B", clientId: "b" } },
    ),
  ).entry;
  entry = applyOperation(
    entry,
    makeOperation(
      entry,
      { ...entry.task, title: "Исходная", comment: "Общий комментарий" },
      { id: "other-edit-2", actor: { uid: "b", name: "B", clientId: "b" } },
    ),
  ).entry;
  f.engine.accept({ entries: [entry], lanes: { items: [] }, conflicts: [] });
  await f.engine.changed({
    basis: f.engine.capture(),
    versionBasis: opened,
    desired: {
      tasks: [{ ...f.board().tasks[0], title: "Моя правка" }],
      owners: [],
    },
  });
  const operation = (await f.outbox.list())[0].operation;
  assert.deepEqual(Object.keys(operation.groups), ["title"]);
  const result = applyOperation(entry, operation);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.entry.task.comment, "Общий комментарий");
});

test("a chooser keeps its displayed version and refreshes rather than writing after a stale response", async () => {
  const f = fixture();
  await f.engine.ready();
  let expected,
    refreshed = 0;
  f.engine.repository = {
    resolve: async (id, choice) => {
      expected = choice.expectedVersion;
      return { stale: true };
    },
  };
  f.engine.refresh = async () => {
    refreshed++;
  };
  const review = [{ id: "conflict", remoteVersion: "displayed-version" }];
  f.engine.conflicts = [{ id: "conflict", remoteVersion: "newer-version" }];
  const result = await f.engine.resolve({ 0: "local" }, review);
  assert.equal(expected, "displayed-version");
  assert.equal(refreshed, 1);
  assert.equal(result.stale, true);
});

test("offline edit followed by archive keeps its causal revision and never conflicts with itself", async () => {
  const f = fixture();
  await f.engine.ready();
  await f.engine.changed({
    basis: f.engine.capture(),
    desired: {
      tasks: [{ ...task, title: "Правка перед архивом" }],
      owners: [],
    },
  });
  await f.engine.changed({
    basis: f.engine.capture(),
    desired: { tasks: [], owners: [] },
  });
  let entry = seedEntry(task);
  for (const row of await f.outbox.list()) {
    const result = applyOperation(entry, row.operation);
    assert.equal(result.conflicts.length, 0);
    entry = result.entry;
  }
  assert.equal(entry.archived, true);
  assert.equal(entry.task.title, "Правка перед архивом");
});
