import test from "node:test";
import assert from "node:assert/strict";
import {
  seedEntry,
  makeOperation,
  applyOperation,
  resolveConflict,
  validateOperation,
  projectOperation,
  toBoard,
} from "../public/team-model.mjs";
const actor = { uid: "user-a", clientId: "device-a", name: "Участник A" },
  other = { uid: "user-b", clientId: "device-b", name: "Участник B" };
const task = {
  id: "task-1",
  title: "Исходная",
  unit: "ГМ",
  status: "В работе",
  owner: "Иван",
  due: "2026-11-09",
  priority: "do",
  positions: {},
};
const seed = () => seedEntry(task);
const edit = (entry, patch, id, who = actor) =>
  makeOperation(entry, { ...entry.task, ...patch }, { id, actor: who });
test("concurrent different fields on one card merge in either commit order", () => {
  const before = seed(),
    a = edit(before, { title: "Название A" }, "op-title-a"),
    b = edit(before, { comment: "Комментарий B" }, "op-comment-b", other);
  for (const order of [
    [a, b],
    [b, a],
  ]) {
    let current = before;
    for (const op of order) {
      const r = applyOperation(current, op);
      assert.equal(r.conflicts.length, 0);
      current = r.entry;
    }
    assert.equal(current.task.title, "Название A");
    assert.equal(current.task.comment, "Комментарий B");
    assert.equal(current.revision, 3);
  }
});
test("concurrent same-field writes preserve the first value and both conflict alternatives", () => {
  const before = seed(),
    a = edit(before, { title: "Название A" }, "op-title-a"),
    b = edit(
      before,
      { title: "Название B", comment: "Отдельное поле" },
      "op-title-b",
      other,
    );
  const first = applyOperation(before, a),
    second = applyOperation(first.entry, b);
  assert.equal(second.entry.task.title, "Название A");
  assert.equal(second.entry.task.comment, "Отдельное поле");
  assert.equal(second.conflicts.length, 1);
  assert.equal(second.conflicts[0].local.title, "Название B");
  assert.equal(second.conflicts[0].remote.title, "Название A");
  assert.equal(second.conflicts[0].base.title, "Исходная");
});
test("field revisions detect an ABA change even when the text returns to its original value", () => {
  const before = seed(),
    stale = edit(before, { title: "Старое намерение" }, "op-stale-a");
  let current = applyOperation(
    before,
    edit(before, { title: "Другое" }, "op-middle-a"),
  ).entry;
  current = applyOperation(
    current,
    edit(current, { title: "Исходная" }, "op-return-a"),
  ).entry;
  assert.equal(applyOperation(current, stale).conflicts.length, 1);
});
test("equal concurrent values are idempotent without a false conflict", () => {
  const before = seed(),
    a = edit(before, { title: "Одинаково" }, "op-equal-a"),
    b = edit(before, { title: "Одинаково" }, "op-equal-b");
  const first = applyOperation(before, a),
    second = applyOperation(first.entry, b);
  assert.equal(second.changed, false);
  assert.equal(second.conflicts.length, 0);
  assert.equal(second.entry.revision, 2);
});
test("conflict resolution compares the observed server version again", () => {
  const before = seed(),
    a = applyOperation(
      before,
      edit(before, { title: "Версия A" }, "op-first-a"),
    ).entry,
    c = applyOperation(
      a,
      edit(before, { title: "Версия B" }, "op-other-b", other),
    ).conflicts[0];
  const later = applyOperation(
    a,
    edit(a, { title: "Версия C" }, "op-third-c"),
  ).entry;
  const stale = resolveConflict(later, c, {
    id: "op-resolve-old",
    choice: "local",
    expectedVersion: c.remoteVersion,
    actor: other,
  });
  assert.equal(stale.stale, true);
  assert.equal(stale.remote.title, "Версия C");
  const accepted = resolveConflict(later, c, {
    id: "op-resolve-new",
    choice: "local",
    expectedVersion: later.versions.title,
    actor: other,
  });
  assert.equal(accepted.entry.task.title, "Версия B");
  assert.equal(accepted.entry.revision, later.revision + 1);
  const keep = resolveConflict(later, c, {
    id: "op-keep-current",
    choice: "remote",
    expectedVersion: later.versions.title,
    actor,
  });
  assert.equal(keep.changed, false);
  assert.equal(keep.resolution.choice, "remote");
});
test("archiving against a concurrent edit conflicts, and edits cannot silently resurrect an archived task", () => {
  const before = seed(),
    archive = makeOperation(before, null, { id: "op-archive-a", actor });
  const edited = applyOperation(
    before,
    edit(before, { comment: "Новый важный текст" }, "op-comment-a"),
  ).entry;
  const conflict = applyOperation(edited, archive);
  assert.equal(conflict.entry.archived, false);
  assert.equal(conflict.conflicts[0].group, "task");
  assert.equal(conflict.conflicts[0].remote.task.comment, "Новый важный текст");
  const archived = applyOperation(before, archive).entry,
    result = applyOperation(
      archived,
      edit(before, { title: "Не потерять" }, "op-late-edit"),
    );
  assert.equal(result.entry.archived, true);
  assert.equal(result.conflicts[0].local.task.title, "Не потерять");
  assert.equal(toBoard([archived]).tasks.length, 0);
});
test("planning dimensions merge independently while assignment and its layout stay together", () => {
  const before = seed(),
    a = edit(
      before,
      {
        owner: "Катя",
        positions: { owners: { group: "owner:Катя", x: 24, y: 96 } },
      },
      "op-owner-a",
    ),
    b = edit(
      before,
      {
        priority: "plan",
        positions: { priority: { group: "plan", x: 24, y: 96 } },
      },
      "op-priority-b",
    );
  const result = applyOperation(applyOperation(before, a).entry, b);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.entry.task.owner, "Катя");
  assert.equal(result.entry.task.priority, "plan");
  assert.ok(result.entry.task.positions.owners);
  assert.ok(result.entry.task.positions.priority);
  const stale = edit(
    before,
    { positions: { owners: { group: "owner:Иван", x: 48, y: 96 } } },
    "op-old-place",
  );
  assert.equal(
    applyOperation(result.entry, stale).conflicts[0].group,
    "assignment",
  );
});
test("offline causal edits use provisional operation stamps and preserve their order", () => {
  const before = seed(),
    a = edit(before, { title: "Промежуточный" }, "op-offline-a"),
    projected = projectOperation(before, a),
    b = edit(projected, { title: "Окончательный" }, "op-offline-b");
  const result = applyOperation(applyOperation(before, a).entry, b);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.entry.task.title, "Окончательный");
  assert.equal(result.entry.versions.title, b.id);
});
test("operation validation rejects a field injected into another conflict group", () => {
  const op = edit(seed(), { owner: "Катя" }, "op-injected");
  op.groups.assignment.value.title = "Нельзя";
  assert.throws(() => validateOperation(op), /Повреждены/);
});
