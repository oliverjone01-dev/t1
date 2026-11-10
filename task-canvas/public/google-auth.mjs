import { SHEET_ID } from "./sync-model.mjs?rev=20261110-progress-5";
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
    this.sessionKey='gengroup.task-canvas.google-session.v1.'+config.clientId;
    this.rememberedEmail='';
    this.restore();
  }
  restore() {
    try {
      const data=JSON.parse(this.env.localStorage?.getItem(this.sessionKey)||'null');
      if(data?.version!==1||data.clientId!==this.config.clientId)return false;
      this.rememberedEmail=typeof data.email==='string'?data.email:'';
      if(typeof data.token==='string'&&Number.isFinite(data.expiresAt)&&data.expiresAt>Date.now()+5000&&(!data.identityOnly||this.config.identityOnly)){
        this.token=data.token;this.expiresAt=data.expiresAt;return true;
      }
    }catch{}
    return false;
  }
  remember(email=this.rememberedEmail) {
    this.rememberedEmail=String(email||'').toLowerCase();
    try {this.env.localStorage?.setItem(this.sessionKey,JSON.stringify({version:1,clientId:this.config.clientId,token:this.token,expiresAt:this.expiresAt,identityOnly:!!this.config.identityOnly,email:this.rememberedEmail}))}catch{}
  }
  invalidate(){this.token=null;this.expiresAt=0;this.remember()}
  needsRefresh(margin=60000){return !this.token||Date.now()>=this.expiresAt-margin}
  getToken() {
    if(this.needsRefresh(5000))this.restore();
    if (this.needsRefresh(5000)) {
      this.token = null;
      throw Object.assign(new Error(this.rememberedEmail?"Обновите разрешение Google. Вход и ваши правки сохранены в браузере.":"Войдите в Google, чтобы продолжить синхронизацию."), { auth: true });
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
          ...(this.rememberedEmail?{login_hint:this.rememberedEmail}:{}),
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
    const profile=await r.json();if(!r.ok){if(r.status===401)this.invalidate();throw Object.assign(new Error(r.status===401?'Разрешение Google истекло. Вход и локальные правки сохранены.':'Не удалось проверить Google-аккаунт. Локальные правки сохранены.'),{status:r.status,auth:r.status===401})}if(profile.email_verified!==true||typeof profile.email!=='string')throw Object.assign(new Error('Google не подтвердил аккаунт владельца.'),{identity:true});
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
    this.rememberedEmail="";
    try{this.env.localStorage?.removeItem(this.sessionKey)}catch{}
  }
}
