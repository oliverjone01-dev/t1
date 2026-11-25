import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../public/app.mjs", import.meta.url),
  "utf8",
);
test("a failed new-card save leaves a draft and retries cannot create duplicate cards", async () => {
  // Exercise the exact shipped submit controller with storage failure, not a rewritten copy.
  const start = source.indexOf("async function submitTask("),
    end = source.indexOf('$("#task-form").onsubmit', start);
  assert.ok(start >= 0 && end > start);
  let draftCalls = 0,
    creates = 0;
  const context = vm.createContext({
    requireEditor:()=>true,
    reportEditor: false,
    tasks: [],
    extraOwners: [],
    editing: null,
    editingBase: {},
    editingVersionBasis:null,
    history: [],
    crypto: { randomUUID: () => String(++creates) },
    formValues: () => ({ title: "Draft" }),
    statusGroup: () => null,
    $: () => ({ checked: false }),
    text: () => {},
    render: () => {},
    saveDraft: () => draftCalls++,
    snapshot: () =>
      JSON.stringify({ tasks: context.tasks, owners: context.extraOwners }),
    planEdit: ({ tasks, createId }) => {
      const task = { id: createId(), title: "Draft" };
      return { kind: "create", task, tasks: [...tasks, task] };
    },
    change: (fn) => {
      fn();
      context.history.push("undo");
      return false;
    },
  });
  await vm.runInContext(
    source.slice(start, end) + ";(async()=>{await submitTask();await submitTask();})()",
    context,
  );
  assert.equal(context.tasks.length, 0);
  assert.equal(context.history.length, 0);
  assert.equal(draftCalls, 2);
  assert.equal(creates, 2);
});

test("the report editor distinguishes a confirmed save from a pending sync", async () => {
  const start = source.indexOf("async function submitTask(");
  const end = source.indexOf('$("#task-form").onsubmit', start);
  for (const synced of [true, false]) {
    const form = { inert: false };
    let closed = false, whileFlushing;
    const task = { id: "report-task", title: "Task" };
    const context = vm.createContext({
      reportEditor: true,
      reportEditorResult: "closed",
      reportEditorFlushing: false,
      DEMO: false,
      requireEditor: () => true,
      tasks: [task],
      editing: task.id,
      editingBase: {},
      editingVersionBasis: null,
      formValues: () => ({ title: "Edited" }),
      planEdit: () => ({ kind: "update", task, tasks: [task] }),
      statusGroup: () => null,
      snapshot: () => "{}",
      history: [],
      $: selector => selector === "#task-form" ? form : { close: () => { closed = true; } },
      change: fn => { fn(); return true; },
      text: () => {},
      renewingSession: null,
      drafts: { remove: () => {} },
      memoryDrafts: new Map(),
      draftFailed: false,
      renderDraftBanner: () => {},
      savedToast: () => {},
      cloudEngine: {
        status: synced ? "synced" : "pending",
        pending: () => synced ? 0 : 1,
        flush() {
          whileFlushing = { closed, inert: form.inert, flushing: context.reportEditorFlushing };
        },
      },
    });
    await vm.runInContext(source.slice(start, end) + ";submitTask()", context);
    assert.deepEqual(whileFlushing, { closed: false, inert: true, flushing: true });
    assert.equal(context.reportEditorResult, synced ? "saved" : "queued");
    assert.equal(closed, true);
    assert.equal(form.inert, false);
  }
});
