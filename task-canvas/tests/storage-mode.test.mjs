import test from 'node:test';
import assert from 'node:assert/strict';
import {readModeControl,modePending,assertSheetWriter,LEGACY_CONTROL,modeWriteRequest} from '../public/storage-mode.mjs';
import {parseCsv,PublicSheetsApi,SheetViewer} from '../public/sheet-viewer.mjs';
import {DirectSheetsApi} from '../public/sheets-api.mjs';
import {SERVICE_HEADERS} from '../public/sync-model.mjs';
const record=(mode,epoch)=>({schema:1,mode,epoch,at:1});
const cell=v=>({formattedValue:JSON.stringify(v)});
function sheetCsv(control){const rows=[Array(22).fill(''),Array(22).fill(''),[...Array(16).fill(''),...SERVICE_HEADERS],Array(22).fill('')];rows[2][0]='ID';rows[2][2]='Направление';rows[2][6]='Задача';rows[1][16]=JSON.stringify(control.request);rows[1][17]=JSON.stringify(control.ack);rows[3][0]='1';rows[3][2]='Задача';rows[3][6]='Тест «CSV»\nв две строки';rows[3][18]='sheet-1';return rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')}
const sheets={request:record('sheets','1'),ack:record('sheets','1')};
test('mode control defaults only when both cells are absent; malformed or incomplete control cannot silently select a mode',()=>{
 assert.deepEqual(readModeControl([]),LEGACY_CONTROL);
 const rows=[[],[]];rows[1][16]=cell(sheets.request);assert.throws(()=>readModeControl(rows),/не завершена/);
 rows[1][17]=cell(sheets.ack);assert.equal(modePending(readModeControl(rows)),false);
 rows[1][16]={formattedValue:'corrupt'};assert.throws(()=>readModeControl(rows),/Повреждена/);
 rows[1][16]=cell({...sheets.request,mode:'other'});assert.throws(()=>readModeControl(rows),/Неизвестная/);
});
test('direct Sheet writes are fenced before a mode request is acknowledged and after switching to Firestore',async()=>{
 const api=new DirectSheetsApi(null);let writes=0;
 api.readStorageControl=async()=>({request:record('firestore','new'),ack:sheets.ack});api.request=async()=>writes++;
 await assert.rejects(api.write({records:[]},[],[]),/Режим/);assert.equal(writes,0);
 assert.throws(()=>assertSheetWriter(LEGACY_CONTROL));assert.doesNotThrow(()=>assertSheetWriter(sheets));
 const req=modeWriteRequest(16,sheets.request,1102202601);assert.deepEqual(req.updateCells.range,{sheetId:1102202601,startRowIndex:1,endRowIndex:2,startColumnIndex:16,endColumnIndex:17});
});
test('CSV preserves blank rows, commas, multiline text, escaped quotes, booleans, numeric-looking IDs and JSON',()=>{
 assert.deepEqual(parseCsv('\uFEFF"a,b","x""y"\r\n,\r\n"line\n2","001"'),[['a,b','x"y'],['',''],['line\n2','001']]);
 for(const bad of ['<html>Login</html>','"unfinished','a"bad','"a"bad'])assert.throws(()=>parseCsv(bad));
 assert.throws(()=>parseCsv('x\n'.repeat(2501)),/2500/);
});
test('public Sheet view reads an anonymous CSV with no credentials and retains task IDs and order data',async()=>{
 const api=new PublicSheetsApi(async(url,options)=>{assert.match(url,/\/export\?format=csv&gid=(1102202601|1478506234)/);assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);return {ok:true,text:async()=>url.includes('gid=1478506234')?sheetCsv(sheets).replaceAll('sheet-1','tg-test'):sheetCsv(sheets)}});
 const result=await api.read();assert.equal(result.board.tasks[0].id,'sheet-1');assert.equal(result.board.tasks[0].title,'Тест «CSV»\nв две строки');assert.equal(result.control.ack.mode,'sheets');assert.equal(result.board.tasks.length,2);
});
test('public mode polling uses only the two bounded configuration cells',async()=>{
 const raw=[sheets.request,sheets.ack].map(v=>'"'+JSON.stringify(v).replaceAll('"','""')+'"').join(',');
 const api=new PublicSheetsApi(async(url)=>{assert.match(url,/range=Q2:R2/);return {ok:true,text:async()=>raw}});assert.deepEqual(await api.control(),sheets);
});
test('a stopped public Sheet viewer cannot apply a late response or schedule another read',async()=>{
 let finish;const promise=new Promise(r=>finish=r);let applied=0,timers=0;
 const viewer=new SheetViewer({api:{read:()=>promise},onControl:()=>{},onData:()=>applied++,onState:()=>{},schedule:()=>timers++,cancel:()=>{}});
 const work=viewer.start();viewer.stop();finish({board:{tasks:[],owners:[]},control:sheets,checkedAt:1});await work;assert.equal(applied,0);assert.equal(timers,0);
});
