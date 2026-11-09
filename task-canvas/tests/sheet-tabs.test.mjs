import test from 'node:test';
import assert from 'node:assert/strict';
import {TAB_ID,TELEGRAM_TAB_ID,SERVICE_HEADERS,decodeSheet,combineSheets,buildWriteRequests} from '../public/sync-model.mjs';
import {SheetsApi} from '../public/sheets-api.mjs';
import {PublicSheetsApi} from '../public/sheet-viewer.mjs';
const cell=formattedValue=>({formattedValue});
function source(sheetId,id){
 const headers=Array(16).fill('');headers[0]='ID';headers[2]='Направление';headers[6]='Задача';
 const row=Array(22).fill('');row[0]=id;row[6]='Задача '+id;row[18]=id;
 return decodeSheet({sheetId,title:String(sheetId),rowCount:4,rows:[[],[],[...headers,...SERVICE_HEADERS].map(cell),row.map(cell)]});
}
test('tasks at the same row on different tabs retain exact write destinations',()=>{
 const primary=source(TAB_ID,'sheet-1'),telegram=source(TELEGRAM_TAB_ID,'tg-1'),combined=combineSheets(primary,telegram);
 assert.equal(combined.board.tasks.length,2);
 const requests=buildWriteRequests(combined,combined.board.tasks.map(task=>({id:task.id,type:'patch',fields:['title'],task:{...task,title:'Правка'}})),[]);
 assert.deepEqual(requests.map(r=>r.updateCells.start),[{sheetId:TAB_ID,rowIndex:3,columnIndex:6},{sheetId:TELEGRAM_TAB_ID,rowIndex:3,columnIndex:6}]);
 const archive=buildWriteRequests(combined,[{id:'tg-1',type:'archive'}],[]);
 assert.equal(archive[0].updateCells.start.sheetId,TELEGRAM_TAB_ID);
 const owners=buildWriteRequests(combined,[{id:'tg-1',type:'patch',fields:['comment'],task:{...telegram.board.tasks[0],comment:'Комментарий'}}],['Иван']);
 assert.equal(owners.at(-1).updateCells.start.sheetId,TAB_ID);
});
test('new Telegram cards append only to Telegram tab; ordinary board cards stay on the main tab',()=>{
 const s=combineSheets(source(TAB_ID,'sheet-1'),source(TELEGRAM_TAB_ID,'tg-1'));
 for(const [id,destination] of [['tg-new',TELEGRAM_TAB_ID],['new-card',TAB_ID]]){
  const requests=buildWriteRequests(s,[{id,type:'upsert',task:{...s.board.tasks[0],id}}],[]);
  assert.equal(requests[0].appendCells.sheetId,destination);
 }
 assert.throws(()=>combineSheets(source(TAB_ID,'same'),source(TELEGRAM_TAB_ID,'same')),/повторяется/);
});
test('authenticated reads combine both pinned tabs and fail if Telegram tab disappears',async()=>{
 const metadata={sheets:[TAB_ID,TELEGRAM_TAB_ID].map((sheetId,index)=>({properties:{sheetId,index,title:String(sheetId),gridProperties:{rowCount:4,columnCount:22}}}))};
 const api=new SheetsApi({});api.request=async path=>path.includes('fields=spreadsheetId')?metadata:{sheets:[{data:[{rowData:source(path.includes(String(TELEGRAM_TAB_ID))?TELEGRAM_TAB_ID:TAB_ID,path.includes(String(TELEGRAM_TAB_ID))?'tg-1':'sheet-1').rows.map(values=>({values}))}]}]};
 const snapshot=await api.read();assert.deepEqual(snapshot.records.map(r=>r.sheetId),[TAB_ID,TELEGRAM_TAB_ID]);
 metadata.sheets.pop();await assert.rejects(api.read(),/Telegram недоступна/);
});
test('anonymous viewer fails as a whole if either tab is unavailable, preserving its previous snapshot',async()=>{
 const s=source(TAB_ID,'sheet-1'),csv=s.rows.map(row=>row.map(c=>'"'+c.formattedValue.replaceAll('"','""')+'"').join(',')).join('\n');
 const api=new PublicSheetsApi(async url=>({ok:!url.includes(String(TELEGRAM_TAB_ID)),text:async()=>csv}));
 await assert.rejects(api.read(),/недоступна/);
});
