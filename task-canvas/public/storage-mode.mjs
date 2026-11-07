export const MODE_OWNER='rayivan001@gmail.com';
export const MODES=Object.freeze({sheets:'Google Таблица',firestore:'Командный · Firestore'});
export const LEGACY_CONTROL=Object.freeze({request:{schema:1,mode:'firestore',epoch:'legacy',at:0},ack:{schema:1,mode:'firestore',epoch:'legacy',at:0}});
export function parseModeCell(text){
 if(!text)return null;
 let v;try{v=JSON.parse(text)}catch{throw new Error('Повреждена настройка хранения. Переключение и запись остановлены.')}
 if(v?.schema!==1||!Object.hasOwn(MODES,v.mode)||typeof v.epoch!=='string'||!v.epoch||v.epoch.length>100||!Number.isFinite(v.at))throw new Error('Неизвестная настройка хранения. Запись остановлена.');
 return v;
}
export function readModeControl(rows){
 const text=c=>String(c?.formattedValue??c?.userEnteredValue?.stringValue??'');
 const request=parseModeCell(text(rows?.[1]?.[16])),ack=parseModeCell(text(rows?.[1]?.[17]));
 if(!request&&!ack)return structuredClone(LEGACY_CONTROL);
 if(!request||!ack)throw new Error('Настройка хранения не завершена. Рабочие задачи сохранены.');
 return {request,ack};
}
export const modePending=control=>control.request.epoch!==control.ack.epoch||control.request.mode!==control.ack.mode;
export function assertSheetWriter(control){
 if(modePending(control)||control.ack.mode!=='sheets')throw Object.assign(new Error('Режим хранения меняется. Правки сохранены на устройстве; дождитесь завершения переключения.'),{modeChanged:true});
}
export function modeWriteRequest(column,value,tabId){return {updateCells:{range:{sheetId:tabId,startRowIndex:1,endRowIndex:2,startColumnIndex:column,endColumnIndex:column+1},rows:[{values:[{userEnteredValue:{stringValue:JSON.stringify(value)}}]}],fields:'userEnteredValue'}}}
