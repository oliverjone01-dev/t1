import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesTask,
  matchesWords,
  importSummary,
  cleanPreferences,
  emptyState,
  demoTasks,
  synchronizationHint,
} from "../public/ui-model.mjs";
test("search matches words across fields in any order and treats ё as е", () => {
  const task = {
    id: "x",
    title: "Подготовить отчёт",
    owner: "Катя",
    sourceId: "90",
    due: "2026-11-06",
  };
  assert.ok(matchesTask(task, "катя отчет"));
  assert.ok(matchesTask(task, "#90 отчёт"));
  assert.ok(matchesTask(task, "06.11.2026 Катя"));
  assert.equal(matchesTask(task, "Катя письмо"), false);
  assert.ok(matchesWords("Новая задача создать", "создать новую") === false);
});
test("import preview counts replacement effects without mutating existing tasks", () => {
  const before = [
      { id: "a", title: "А" },
      { id: "b", title: "Б" },
    ],
    after = [
      { id: "a", title: "Изменено" },
      { id: "c", title: "Новое" },
    ];
  assert.deepEqual(importSummary(before, after), {
    added: 1,
    changed: 1,
    removed: 1,
    total: 2,
  });
  assert.equal(before[0].title, "А");
});
test("preferences recover safely and empty/loading/no source are different states", () => {
  assert.deepEqual(
    cleanPreferences({ theme: "injected", density: "unknown" }),
    { theme: "system", density: "comfortable" },
  );
  assert.equal(
    emptyState({ count: 0, hasBaseline: false, status: "syncing" }).action,
    null,
  );
  assert.equal(
    emptyState({ count: 0, hasBaseline: true, status: "synced" }).action,
    "create",
  );
  assert.equal(
    emptyState({ count: 0, hasBaseline: false, status: "signin" }).action,
    "connect",
  );
  assert.ok(demoTasks().every((task) => task.id.startsWith("example-")));
});

test('sync failures have distinct textual hints independent of a hidden desktop sidebar',()=>{
 assert.match(synchronizationHint({status:'signin'}),/вход Google/);
 assert.match(synchronizationHint({status:'offline'}),/последняя копия/);
 assert.match(synchronizationHint({status:'conflict'}),/сравнить версии/);
 assert.match(synchronizationHint({status:'cache-error'}),/восстановления/);
 assert.equal(synchronizationHint({status:'synced'}),'');
 assert.equal(synchronizationHint(null),'');
});
