import {
  DraftStore,
  editorValues,
  EDIT_FIELDS,
} from "./editor.mjs?rev=20261106-team-1";
// Every page owns its draft slot. Reloaded and sibling-page variants remain recoverable.
export class TeamDraftStore {
  constructor(storage, prefix, writer = crypto.randomUUID()) {
    this.storage = storage;
    this.prefix = prefix + ".draft.";
    this.writer = writer;
    this.legacy = new DraftStore(storage, "gengroup.task-canvas.v1");
  }
  key(id) {
    return this.prefix + this.writer + ":" + encodeURIComponent(id ?? "__new");
  }
  list() {
    const drafts = [],
      errors = [];
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key?.startsWith(this.prefix)) continue;
        try {
          const record = JSON.parse(this.storage.getItem(key));
          if (
            record?.version !== 1 ||
            !record.base ||
            !record.values ||
            !Number.isFinite(record.updatedAt)
          )
            throw new Error();
          drafts.push({
            ...record,
            key,
            values: editorValues(record.values),
            base: editorValues(record.base),
          });
        } catch {
          errors.push(key);
        }
      }
      const old = this.legacy.list();
      drafts.push(
        ...old.drafts.map((record) => ({
          ...record,
          key: this.legacy.key(record.id),
          legacy: true,
        })),
      );
      errors.push(...old.errors);
    } catch {
      errors.push("storage-unavailable");
    }
    return { drafts: drafts.sort((a, b) => b.updatedAt - a.updatedAt), errors };
  }
  read(id) {
    const rows = this.list().drafts.filter((record) => record.id === id);
    return (
      rows.find((record) => record.key === this.key(id)) || rows[0] || null
    );
  }
  save(id, base, values, updatedAt = Date.now()) {
    try {
      const record = {
        version: 1,
        id,
        writer: this.writer,
        base: editorValues(base),
        values: editorValues(values),
        updatedAt,
      };
      if (EDIT_FIELDS.every((key) => record.base[key] === record.values[key]))
        this.remove(id);
      else this.storage.setItem(this.key(id), JSON.stringify(record));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }
  remove(id) {
    this.storage.removeItem(this.key(id));
  }
  discard(record) {
    if (!record?.key?.startsWith(this.prefix) && !record?.legacy)
      throw new Error("Черновик не найден.");
    this.storage.removeItem(record.key);
  }
}
