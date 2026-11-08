import { SHEET_ID } from "./sync-model.mjs?rev=20261109-productivity-1";
const cancelled = () =>
  Object.assign(new Error("Подключение отменено."), { cancelled: true });
export class GoogleAuth {
  constructor(
    config,
    {
      environment = globalThis,
      schedule = (...args) => setTimeout(...args),
      cancelTimer = (...args) => clearTimeout(...args),
    } = {},
  ) {
    this.config = config;
    this.env = environment;
    this.schedule = schedule;
    this.cancelTimer = cancelTimer;
    this.token = null;
    this.expiresAt = 0;
    this.generation = 0;
  }
  getToken() {
    if (!this.token || Date.now() >= this.expiresAt - 5000) {
      this.token = null;
      throw Object.assign(
        new Error("Войдите в Google, чтобы продолжить синхронизацию."),
        { auth: true },
      );
    }
    return this.token;
  }
  cancelPending() {
    this.generation++;
    this.cancelAuth?.();
    this.cancelLoad?.();
    this.cancelPicker?.();
  }
  authorize() {
    const oauth = this.env.google?.accounts?.oauth2;
    if (!this.config.clientId)
      return Promise.reject(new Error("Подключение Google ещё не настроено."));
    if (!oauth)
      return Promise.reject(
        new Error(
          "Google ещё загружается. Повторите вход через несколько секунд.",
        ),
      );
    this.cancelPending();
    return new Promise((resolve, reject) => {
      let settled = false,
        timer;
      const finish = (error, response) => {
        if (settled) return;
        settled = true;
        this.cancelTimer(timer);
        this.cancelAuth = null;
        if (error) {
          reject(error);
          return;
        }
        this.token = response.access_token;
        const seconds = Number(response.expires_in);
        this.expiresAt =
          Date.now() +
          (Number.isFinite(seconds) && seconds > 0
            ? Math.min(seconds, 86400)
            : 3600) *
            1000;
        resolve();
      };
      this.cancelAuth = () => finish(cancelled());
      timer = this.schedule(
        () =>
          finish(
            new Error(
              "Google не завершил вход. Проверьте всплывающее окно. Если вы открыли доску внутри другого приложения, откройте её в обычном браузере.",
            ),
          ),
        120000,
      );
      try {
        const client = oauth.initTokenClient({
          client_id: this.config.clientId,
          scope: this.config.identityOnly?"openid email profile":"openid email profile https://www.googleapis.com/auth/drive.file",
          include_granted_scopes: false,
          callback: (response) =>
            response.error || !response.access_token
              ? finish(new Error("Google не предоставил доступ к таблице."))
              : finish(null, response),
          error_callback: () =>
            finish(
              new Error(
                "Окно входа закрыто или заблокировано. Повторите вход в Google.",
              ),
            ),
        });
        client.requestAccessToken({ prompt: "" });
      } catch (error) {
        finish(error);
      }
    });
  }
  async profile(fetcher=(...args)=>fetch(...args)) {
    const r=await fetcher('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+this.getToken()},cache:'no-store',redirect:'error'});
    const profile=await r.json();if(!r.ok||profile.email_verified!==true||typeof profile.email!=='string')throw new Error('Google не подтвердил аккаунт владельца.');
    return profile;
  }
  async pickFile() {
    const { gapi, google } = this.env,
      generation = this.generation;
    if (!gapi)
      throw new Error(
        "Выбор таблицы Google ещё загружается. Повторите подключение.",
      );
    await new Promise((resolve, reject) => {
      let settled = false,
        timer;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        this.cancelTimer(timer);
        this.cancelLoad = null;
        error ? reject(error) : resolve();
      };
      this.cancelLoad = () => finish(cancelled());
      timer = this.schedule(
        () =>
          finish(
            new Error(
              "Не удалось загрузить выбор таблицы. Проверьте сеть и повторите.",
            ),
          ),
        15000,
      );
      try {
        gapi.load("picker", {
          callback: () => finish(),
          onerror: () =>
            finish(new Error("Не удалось загрузить выбор таблицы.")),
        });
      } catch (error) {
        finish(error);
      }
    });
    if (generation !== this.generation) throw cancelled();
    return new Promise((resolve, reject) => {
      let settled = false,
        picker;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        this.cancelPicker = null;
        picker?.setVisible(false);
        error ? reject(error) : resolve();
      };
      this.cancelPicker = () => finish(cancelled());
      try {
        const view = new google.picker.DocsView(
          google.picker.ViewId.SPREADSHEETS,
        )
          .setFileIds(SHEET_ID)
          .setMode(google.picker.DocsViewMode.LIST);
        picker = new google.picker.PickerBuilder()
          .addView(view)
          .setAppId(this.config.projectNumber)
          .setDeveloperKey(this.config.apiKey)
          .setOAuthToken(this.getToken())
          .setOrigin(this.env.location.origin)
          .setTitle("Подключить таблицу задач GENGROUP")
          .setCallback((data) => {
            if (data.action === google.picker.Action.CANCEL)
              finish(cancelled());
            if (data.action === google.picker.Action.PICKED)
              finish(
                data.docs?.[0]?.id === SHEET_ID
                  ? null
                  : new Error("Выберите таблицу ЕМО - Раюшкин 2026."),
              );
          })
          .build();
        picker.setVisible(true);
      } catch (error) {
        finish(error);
      }
    });
  }
  disconnect() {
    this.cancelPending();
    this.token = null;
    this.expiresAt = 0;
  }
}
