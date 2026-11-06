import test from "node:test";
import assert from "node:assert/strict";
import { TeamDraftStore } from "../public/team-drafts.mjs";
const memory = () => {
  const rows = new Map();
  return {
    get length() {
      return rows.size;
    },
    key: (i) => [...rows.keys()][i],
    getItem: (key) => rows.get(key) || null,
    setItem: (key, value) => rows.set(key, value),
    removeItem: (key) => rows.delete(key),
  };
};
test("two pages keep both same-card drafts and every variant remains selectable after reload", () => {
  const storage = memory(),
    a = new TeamDraftStore(storage, "team", "page-a"),
    b = new TeamDraftStore(storage, "team", "page-b");
  assert.equal(a.save("card", { title: "Base" }, { title: "A" }, 1).ok, true);
  assert.equal(b.save("card", { title: "Base" }, { title: "B" }, 2).ok, true);
  assert.equal(a.read("card").values.title, "A");
  assert.equal(b.read("card").values.title, "B");
  const c = new TeamDraftStore(storage, "team", "page-c");
  assert.deepEqual(
    c.list().drafts.map((d) => d.values.title),
    ["B", "A"],
  );
  c.save("card", { title: "Base" }, { title: "C" }, 3);
  c.remove("card");
  assert.equal(c.list().drafts.length, 2);
  c.discard(c.list().drafts[0]);
  assert.equal(a.read("card").values.title, "A");
});
