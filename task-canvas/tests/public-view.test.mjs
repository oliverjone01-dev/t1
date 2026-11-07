import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { readPublicEntry } from "../public/board-viewer.mjs";
const source = await readFile(
  new URL("../public/app.mjs", import.meta.url),
  "utf8",
);
test("guest projection rejects private record envelopes and validates visible cards", () => {
  const doc = {
    schema: 1,
    revision: 1,
    task: { id: "visible", title: "Actual public task", positions: {} },
  };
  assert.equal(readPublicEntry(doc).title, "Actual public task");
  assert.throws(() => readPublicEntry({ ...doc, actor: { uid: "private" } }));
  assert.throws(() =>
    readPublicEntry({ ...doc, sheet: { task: { title: "Old version" } } }),
  );
  assert.throws(() => readPublicEntry({ ...doc, revision: 0 }));
});
test("guest cache cannot overwrite the editable copy or clear unsent intentions", () => {
  const data = new Map([
    ["editor", "private cached edits"],
    ["outbox", "durable operation"],
  ]);
  const context = vm.createContext({
    DEMO: false,
    accessMode: "view",
    VIEW_STORAGE: "viewer",
    STORAGE: "editor",
    tasks: [{ id: "visible", title: "Current public version" }],
    extraOwners: ["Team"],
    mode: "list",
    lastCanvasMode: "priority",
    camera: { x: 0, y: 0, z: 1 },
    viewerReadAt: 42,
    inbox: { snapshot: () => [] },
    storage: { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) },
  });
  const start = source.indexOf("function persist() {"),
    end = source.indexOf("function savedToast", start);
  vm.runInContext(source.slice(start, end) + ";persist()", context);
  assert.equal(data.get("editor"), "private cached edits");
  assert.equal(data.get("outbox"), "durable operation");
  assert.equal(
    JSON.parse(data.get("viewer")).tasks[0].title,
    "Current public version",
  );
  context.accessMode = "connecting";
  context.tasks = [];
  vm.runInContext("persist()", context);
  assert.equal(JSON.parse(data.get("viewer")).tasks.length, 1);
  assert.equal(data.get("editor"), "private cached edits");
});
test("anonymous mutation entry points stop before creating an operation", async () => {
  const context = vm.createContext({ requireEditor: () => false });
  for (const signature of [
    "async function change(",
    "async function restore(",
    "async function submitTask(",
  ]) {
    const start = source.indexOf(signature),
      body = source.slice(start, source.indexOf("\n}", start) + 2);
    await vm.runInContext(
      body +
        ";" +
        (signature.includes("change(")
          ? 'change(()=>{throw new Error("mutation")})'
          : signature.includes("restore(")
            ? "restore([],[])"
            : "submitTask()"),
      context,
    );
  }
});

test("a public JSON export never reads or includes editor drafts", async () => {
  let captured;
  const context = vm.createContext({
    canEdit: () => false,
    draftRecords: () => {
      throw new Error("Private drafts read by guest");
    },
    tasks: [{ id: "visible", title: "Public card" }],
    extraOwners: [],
    mode: "list",
    camera: {},
    Blob: class {
      constructor(parts) {
        captured = parts.join("");
      }
    },
    URL: { createObjectURL: () => "/download", revokeObjectURL: () => {} },
    document: { createElement: () => ({ click: () => {} }) },
    DEMO: false,
    today: () => "2026-11-07",
    setTimeout: () => 0,
    toast: () => {},
  });
  const start = source.indexOf("function exportBoard() {"),
    end = source.indexOf('$("#export").onclick', start);
  vm.runInContext(source.slice(start, end) + ";exportBoard()", context);
  assert.deepEqual(JSON.parse(captured).drafts, []);
  assert.equal(JSON.parse(captured).tasks[0].title, "Public card");
});
