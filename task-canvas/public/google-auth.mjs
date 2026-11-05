import {SHEET_ID} from './sync-model.mjs';
export class GoogleAuth {
  constructor(config) {this.config=config;this.token=null;this.expiresAt=0;}
  getToken() {
    if(!this.token || Date.now()>=this.expiresAt-5000) {this.token=null;const e=new Error('Войдите в Google, чтобы продолжить синхронизацию.');e.auth=true;throw e;}
    return this.token;
  }
  authorize() {
    if(!this.config.clientId) return Promise.reject(new Error('Подключение Google ещё не настроено.'));
    if(!window.google?.accounts?.oauth2) return Promise.reject(new Error('Google ещё загружается. Повторите подключение через несколько секунд.'));
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(error,response)=>{
        if(settled)return;
        settled=true;clearTimeout(timeout);
        if(error){reject(error);return;}
        this.token=response.access_token;this.expiresAt=Date.now()+Number(response.expires_in || 3600)*1000;resolve();
      };
      const timeout=setTimeout(()=>finish(new Error('Google не завершил вход. Разрешите всплывающее окно или откройте доску в обычном Chrome и повторите подключение.')),120000);
      const client=google.accounts.oauth2.initTokenClient({
        client_id:this.config.clientId,scope:'https://www.googleapis.com/auth/drive.file',include_granted_scopes:false,
        callback:response=>{
          if(response.error || !response.access_token) {finish(new Error('Google не предоставил доступ к таблице.'));return;}
          finish(null,response);
        },
        error_callback:()=>finish(new Error('Окно входа закрыто или заблокировано. Нажмите «Подключить Google» ещё раз.')),
      });
      try {client.requestAccessToken({prompt:''});} catch(error) {finish(error);}
    });
  }
  async pickFile() {
    if(!window.gapi) throw new Error('Окно выбора Google ещё загружается.');
    await new Promise((resolve,reject)=>gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Не удалось загрузить выбор таблицы.'))}));
    return new Promise((resolve,reject)=>{
      const view=new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setFileIds(SHEET_ID).setMode(google.picker.DocsViewMode.LIST);
      const picker=new google.picker.PickerBuilder().addView(view).setAppId(this.config.projectNumber).setDeveloperKey(this.config.apiKey).setOAuthToken(this.getToken()).setOrigin(window.location.origin).setTitle('Подключить таблицу задач GENGROUP').setCallback(data=>{
        if(data.action===google.picker.Action.CANCEL)reject(new Error('Выбор таблицы отменён.'));
        if(data.action===google.picker.Action.PICKED) {
          if(data.docs?.[0]?.id!==SHEET_ID) {reject(new Error('Выберите таблицу ЕМО - Раюшкин 2026.'));return;}
          resolve();
        }
      }).build();picker.setVisible(true);
    });
  }
  disconnect() {this.token=null;this.expiresAt=0;}
}
