import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { TeamOutbox } from "../public/team-outbox.mjs";
const operation = (id, uid = "alice") => ({
  id,
  kind: "edit",
  taskId: "test",
  actor: { uid, clientId: "tab-a" },
  groups: { title: { value: { title: id } } },
});
function pair() {
  const db = new IDBFactory();
  return [
    new TeamOutbox(db, { namespace: "board" }),
    new TeamOutbox(db, { namespace: "board" }),
  ];
}
test("two tabs append durable intents without overwriting one another and claims serialize", async () => {
  const [a, b] = pair();
  await Promise.all(
    Array.from({ length: 40 }, (_, i) =>
      (i % 2 ? a : b).addMany([operation("operation-" + i)]),
    ),
  );
  const rows = await a.list();
  assert.equal(rows.length, 40);
  assert.equal(new Set(rows.map((row) => row.sequence)).size, 40);
  const [one, two] = await Promise.all([
    a.claim(rows[0].id, "worker-a", 1000),
    b.claim(rows[0].id, "worker-b", 1000),
  ]);
  assert.equal([one, two].filter(Boolean).length, 1);
  await a.acknowledge(rows[0].id);
  assert.equal((await b.list()).length, 39);
});
test("a failed multi-intent transaction leaves the existing queue intact", async () => {
  const [a] = pair();
  await a.addMany([operation("existing")]);
  await assert.rejects(
    a.addMany([
      operation("new-one"),
      { ...operation("existing"), taskId: "different" },
    ]),
    /другую правку/,
  );
  const rows = await a.list();
  assert.deepEqual(
    rows.map((row) => row.id),
    ["existing"],
  );
});
test("held disconnected edits require an explicit reconnect and only unsent identities are adopted", async () => {
  const [a, b] = pair();
  await a.addMany([operation("pending-op", "pending-login")], { hold: true });
  assert.equal(await b.claim("pending-op", "worker-b"), null);
  await b.adoptPending("alice");
  const claimed = await a.claim("pending-op", "worker-a", 1000);
  assert.equal(claimed.operation.actor.uid, "alice");
  await b.adoptPending("bob");
  assert.equal((await b.list())[0].operation.actor.uid, "alice");
  const replacement = await b.claim("pending-op", "worker-b", 122000);
  assert.ok(replacement);
  await a.release("pending-op", "worker-a");
  assert.equal((await b.list())[0].claim.worker, "worker-b");
});
