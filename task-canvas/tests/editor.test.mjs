import test from "node:test";
import assert from "node:assert/strict";
import {
  planEdit,
  editorValues,
  resumeDraft,
  DraftStore,
} from "../public/editor.mjs";
import { parseAssignee } from "../public/people.mjs";
const task = {
  id: "sheet-1",
  title: "Исходная",
  owner: "Иван",
  due: "2026-11-09",
  priority: "plan",
  status: "В работе",
  comment: "",
  positions: {},
};
const edit = (extra = {}) =>
  planEdit({
    tasks: [task],
    id: task.id,
    base: task,
    values: editorValues(task),
    createId: () => "new-id",
    ...extra,
  });
class MemoryStorage {
  data = new Map();
  get length() {
    return this.data.size;
  }
  key(i) {
    return [...this.data.keys()][i];
  }
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, value);
  }
  removeItem(key) {
    this.data.delete(key);
  }
}
test("a removed open card is not silently recreated, and its draft remains available", () => {
  let generated = 0;
  assert.equal(
    edit({
      tasks: [],
      createId: () => {
        generated++;
        return "bad";
      },
    }).kind,
    "missing",
  );
  assert.equal(generated, 0);
  const result = edit({ tasks: [], forceNew: true });
  assert.equal(result.kind, "create");
  assert.equal(result.task.id, "new-id");
  assert.equal(result.task.owner, "Иван");
});
test("editor preserves an unrelated remote change and detects a conflicting field", () => {
  const values = { ...editorValues(task), comment: "Мой текст" };
  const merged = edit({ tasks: [{ ...task, owner: "Катя" }], values });
  assert.equal(merged.task.owner, "Катя");
  assert.equal(merged.task.comment, "Мой текст");
  const conflict = edit({
    tasks: [{ ...task, comment: "Текст из Google" }],
    values,
  });
  assert.equal(conflict.kind, "conflict");
  assert.equal(conflict.conflicts[0].remote, "Текст из Google");
});
test("invalid owner and capacity fail before mutating the board", () => {
  assert.equal(
    edit({ values: { ...editorValues(task), owner: "Иван; Катя" } }).field,
    "owner",
  );
  assert.equal(parseAssignee("  Иван   Раюшкин  "), "Иван Раюшкин");
  assert.equal(parseAssignee("Иван - инициатор"), null);
  const tasks = Array.from({ length: 2000 }, (_, i) => ({
    ...task,
    id: String(i),
  }));
  assert.equal(edit({ tasks, id: null }).kind, "invalid");
  assert.equal(tasks.length, 2000);
});
test("drafts survive a new instance and editing another card does not overwrite them", () => {
  const storage = new MemoryStorage(),
    store = new DraftStore(storage, "qa");
  assert.ok(store.save(task.id, task, { ...task, title: "Черновик" }).ok);
  assert.ok(store.save("other", task, { ...task, comment: "Другой текст" }).ok);
  const again = new DraftStore(storage, "qa");
  assert.equal(again.read(task.id).values.title, "Черновик");
  assert.equal(again.list().drafts.length, 2);
  again.remove("other");
  assert.equal(again.list().drafts.length, 1);
});
test("restoring a draft refreshes untouched fields and preserves conflicting user text", () => {
  const draft = {
    base: editorValues(task),
    values: editorValues({ ...task, comment: "Мой черновик" }),
  };
  const resumed = resumeDraft(
    { ...task, owner: "Катя", comment: "Правка Google" },
    draft,
  );
  assert.equal(resumed.values.owner, "Катя");
  assert.equal(resumed.values.comment, "Мой черновик");
  assert.equal(resumed.conflicts[0].remote, "Правка Google");
  assert.equal(resumeDraft(null, draft).values.due, task.due);
});
test("corrupt or full storage never overwrites the previous draft silently", () => {
  const storage = new MemoryStorage(),
    store = new DraftStore(storage, "qa");
  storage.setItem(store.key(task.id), "{broken");
  assert.equal(
    store.save(task.id, task, { ...task, title: "Новый" }).ok,
    false,
  );
  assert.equal(storage.getItem(store.key(task.id)), "{broken");
  storage.data.clear();
  store.save(task.id, task, { ...task, title: "Первая копия" });
  const previous = storage.getItem(store.key(task.id));
  storage.setItem = () => {
    throw new Error("Quota");
  };
  assert.equal(
    store.save(task.id, task, { ...task, title: "Следующая копия" }).ok,
    false,
  );
  assert.equal(storage.getItem(store.key(task.id)), previous);
});
