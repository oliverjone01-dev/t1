import { firebaseSdk } from "./team-api.mjs?rev=20261108-ui-2";
import { validateBoard } from "./model.mjs?rev=20261108-ui-2";
export function readPublicEntry(value) {
  if (
    value?.schema !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    Object.keys(value).some(
      (key) => !["schema", "revision", "task"].includes(key),
    )
  )
    throw new Error("Не удалось прочитать карточку общей доски.");
  return validateBoard([value.task])[0];
}
export class BoardViewer {
  constructor({ config, boardId, sdk = null, db = null, onData, onState }) {
    Object.assign(this, { config, boardId, sdk, db, onData, onState });
    this.generation = 0;
    this.listeners = [];
  }
  async initialize() {
    if (this.db) return;
    const s = (this.sdk ??= await firebaseSdk());
    if (!this.initializing)
      this.initializing = Promise.resolve().then(() => {
        this.app = s.initializeApp(this.config, "task-canvas-public-view");
        // A separate, deliberately unsigned session never uses the editor's token.
        s.initializeAuth(this.app, { persistence: s.inMemoryPersistence });
        this.db = s.initializeFirestore(this.app, {
          localCache: s.memoryLocalCache(),
          experimentalAutoDetectLongPolling: true,
        });
      });
    await this.initializing;
  }
  async start() {
    this.stop();
    const generation = this.generation;
    this.onState({ status: "view-loading" });
    try {
      await this.initialize();
      if (generation !== this.generation) return;
      const s = this.sdk,
        state = {},
        caches = {};
      const emit = () => {
        if (!state.root || !state.tasks || !state.lanes) return;
        if (!state.root.ready)
          throw new Error("Общий просмотр ещё подготавливается.");
        const fromCache = Object.values(caches).some(Boolean),
          board = { tasks: state.tasks, owners: state.lanes.items || [] };
        if(fromCache){this.onState({status:"view-offline",source:state.source,background:state.root.background});return;}
        this.onData(board, {
          fromCache,
          source: state.source || { status: "pending", checkedAt: 0 },
        });
        this.onState({
          status: fromCache ? "view-offline" : "view-live",
          source: state.source,
          background: state.root.background,
        });
      };
      const watch = (ref, key, convert) =>
        this.listeners.push(
          s.onSnapshot(
            ref,
            { includeMetadataChanges: true },
            (snapshot) => {
              if (generation !== this.generation) return;
              try {
                state[key] = convert(snapshot);
                caches[key] = snapshot.metadata.fromCache;
                emit();
              } catch (error) {
                this.onState({ status: "view-error", message: error.message });
              }
            },
            () => {
              if (generation === this.generation)
                this.onState({
                  status: "view-error",
                  message:
                    "Не удалось получить актуальную доску. Повторите подключение к просмотру.",
                });
            },
          ),
        );
      watch(s.doc(this.db, "taskBoardViews", this.boardId), "root", (d) =>
        d.exists() ? d.data() : null,
      );
      watch(
        s.collection(this.db, "taskBoardViews", this.boardId, "tasks"),
        "tasks",
        (d) => d.docs.map((row) => readPublicEntry(row.data())),
      );
      watch(
        s.doc(this.db, "taskBoardViews", this.boardId, "meta", "lanes"),
        "lanes",
        (d) => (d.exists() ? d.data() : { items: [] }),
      );
      watch(
        s.doc(this.db, "taskBoardViews", this.boardId, "meta", "source"),
        "source",
        (d) => (d.exists() ? d.data() : { status: "pending", checkedAt: 0 }),
      );
    } catch {
      if (generation === this.generation)
        this.onState({
          status: "view-error",
          message:
            "Не удалось загрузить просмотр. Проверьте соединение и повторите.",
        });
    }
  }
  stop() {
    this.generation++;
    this.listeners.splice(0).forEach((fn) => fn());
  }
}
