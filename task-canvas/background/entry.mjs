import {createWorker} from './worker.mjs';
const services=()=>({Utilities,ScriptApp,PropertiesService,CacheService,LockService,UrlFetchApp,Session});
export const prepare=()=>createWorker(services()).prepare();
export const activate=()=>createWorker(services()).activate();
export const run=()=>createWorker(services()).run();
export const check=()=>createWorker(services()).check();
export const stop=()=>createWorker(services()).stop();
