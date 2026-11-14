import fs from 'node:fs';
export function selectedDashboardBase(file=process.env.GG_ROUTING_STATE||'/srv/gg/routing/mode.json'){
 let mode='domain';try{mode=JSON.parse(fs.readFileSync(file,'utf8')).mode;}catch(e){if(e.code!=='ENOENT')throw Error('Dashboard routing state is unavailable');}
 if(mode==='ip')return 'https://201.51.7.251:8443';if(mode==='domain')return 'https://dash.genglas.ru';throw Error('Unknown dashboard routing mode');
}
export function routeDashboardLinks(text,base=selectedDashboardBase()){
 if(typeof text!=='string')return text;
 return text.replace(/https:\/\/(?:dash\.genglas\.ru|201\.51\.7\.251:8443)(?=\/|[\s"'<>)]|$)/g,base).replace(/https:\/\/oliverjone01-dev\.github\.io\/t1(?=\/(?:rop(?:-[a-z-]+)?|dashboards|dialog|office|prod|pto|economics|econ-control|plan|structure|status)(?:\/|[?#\s"'<>)]|$))/g,base);
}
export function routeTelegramPayload(body,base=selectedDashboardBase()){
 if(!body||typeof body!=='object')return body;const result={...body};
 for(const k of['text','caption'])if(typeof result[k]==='string')result[k]=routeDashboardLinks(result[k],base);
 if(result.reply_markup?.inline_keyboard)result.reply_markup={...result.reply_markup,inline_keyboard:result.reply_markup.inline_keyboard.map(row=>row.map(b=>b.url?{...b,url:routeDashboardLinks(b.url,base)}:b))};return result;
}
const original=globalThis.fetch;
globalThis.fetch=function(url,options){
 let u;try{u=new URL(typeof url==='string'?url:url.url);}catch{return original(url,options);}
 if(u.origin!=='https://api.telegram.org'||!/^\/bot[^/]+\/sendMessage$/.test(u.pathname)||typeof options?.body!=='string')return original(url,options);
 let body;try{body=JSON.parse(options.body);}catch{return original(url,options);}
 return original(url,{...options,body:JSON.stringify(routeTelegramPayload(body))});
};
