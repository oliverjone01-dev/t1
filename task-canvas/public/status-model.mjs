export const STATUS_STYLE={
 'Не указан':{key:'none',symbol:'○',card:'#f3f4f6',badge:'#e5e7eb',ink:'#374151'},
 'В ожидании':{key:'waiting',symbol:'◷',card:'#edf6ff',badge:'#cce6ff',ink:'#245578'},
 'В работе':{key:'working',symbol:'◐',card:'#fff3e5',badge:'#ffd9ad',ink:'#774015'},
 'Приостановлено':{key:'paused',symbol:'Ⅱ',card:'#fff0f4',badge:'#f8ccda',ink:'#84334e'},
 'Готово':{key:'done',symbol:'✓',card:'#f0f8e5',badge:'#cfeac0',ink:'#2c5e30'},
 'Отменено':{key:'cancelled',symbol:'×',card:'#f2f1f3',badge:'#e6dfe5',ink:'#665362'},
};
export const statusStyle=s=>STATUS_STYLE[s]||STATUS_STYLE['Не указан'];
const rgb=hex=>Object.fromEntries(['red','green','blue'].map((k,i)=>[k,parseInt(hex.slice(1+i*2,3+i*2),16)/255]));
// Open-ended rules follow appended rows. Existing rules and cell values are untouched.
export function statusRules(sheetId){return Object.entries(STATUS_STYLE).filter(([s])=>s!=='Не указан').flatMap(([s,c])=>[
 {ranges:[{sheetId,startRowIndex:3,startColumnIndex:8,endColumnIndex:9}],booleanRule:{condition:{type:'CUSTOM_FORMULA',values:[{userEnteredValue:`=$I4="${s}"`}]},format:{backgroundColor:rgb(c.badge),textFormat:{foregroundColor:rgb(c.ink)}}}},
 {ranges:[{sheetId,startRowIndex:3,startColumnIndex:0,endColumnIndex:22}],booleanRule:{condition:{type:'CUSTOM_FORMULA',values:[{userEnteredValue:`=$I4="${s}"`}]},format:{backgroundColor:rgb(c.card)}}},
]);}
