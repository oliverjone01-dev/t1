import { validateBoard } from './model.mjs?rev=20261106-feniks-2';
export function dataSignature(state) {
  return JSON.stringify({tasks: validateBoard(state), owners: Array.isArray(state?.owners) ? state.owners : []});
}
export function writeBoard(storage, key, state, expectedSignature) {
  try {
    const raw = storage.getItem(key);
    if (dataSignature(raw ? JSON.parse(raw) : {tasks:[],owners:[]}) !== expectedSignature) return {ok:false, reason:'conflict'};
    storage.setItem(key, JSON.stringify(state));
    return {ok:true, signature:dataSignature(state)};
  } catch (error) { return {ok:false, reason:'storage', message:error.message}; }
}
