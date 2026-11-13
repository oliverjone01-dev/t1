// Authentication is distinct from queued writes and transient network errors.
export function googleStatusLabel(state={}, {editing=false,remembered=false}={}) {
 const labels={synced:'Google · сохранено',pending:'Google · сохраняем',syncing:state.pending?'Google · сохраняем':'Google · проверка','data-error':'Google · проверьте таблицу',offline:'Google · нет связи',conflict:'Google · конфликт','cache-error':'Google · ошибка очереди','access-denied':'Google · нет доступа'};
 if(state.status==='signin')return remembered?'Google · обновить доступ':'Войти через Google';
 return labels[state.status]||(editing?'Google · локальная копия':'Подключить Google');
}

export const sheetFailureStatus=error=>error?.auth?'signin':/повторяется ID|ID карточки повторяется|нет ID|Служебные колонки|Повреждены|Неизвестный приоритет|содержит формулу|не разрешено/.test(error?.message||'')?'data-error':'offline';

export function connectionAction(state={},connected=false){
 const retry=connected&&!['signin','access-denied','cache-error'].includes(state.status);
 return {retry,label:state.status==='data-error'&&retry?'Проверить таблицу':retry?'Повторить синхронизацию':'Войти и подключить'};
}
