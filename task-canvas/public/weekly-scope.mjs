export function filterWeeklyRows(rows,{owner='',unit='',query=''}={},ownerName=t=>t.owner||'') {
 const q=query.trim().toLocaleLowerCase('ru');
 return rows.filter(t=>(!owner||ownerName(t)===owner)&&(!unit||t.unit===unit)&&(!q||[t.title,ownerName(t),t.ownerNote,t.comment].join(' ').toLocaleLowerCase('ru').includes(q)));
}
export function weeklyMetrics(tab,rows,{historical=false,baseline=false,today='',ownerName=t=>t.owner||''}={}) {
 const planned=rows.filter(t=>t.planned).length,done=rows.filter(t=>t.planned&&t.outcome==='done').length;
 if(tab==='fact')return [[historical?'—':planned,'В первоначальном плане','Снимок начала недели'],[historical?'—':done,'Выполнено из плана','Отмена считается отдельно','good'],[historical||!planned?'—':Math.round(done/planned*100)+'%','Выполнение плана','По количеству задач'],[historical?'—':rows.filter(t=>!t.planned&&t.outcome==='done').length,'Выполнено вне плана','Дополнительная работа']];
 if(tab==='plan')return [[rows.length,'Задач в плане',baseline?'Зафиксированный состав':'Предварительный состав'],[new Set(rows.map(ownerName).filter(Boolean)).size,'Ответственных','Индивидуальные назначения'],[rows.filter(t=>!t.owner).length,'Без ответственного','Нужно решение','warn'],[rows.filter(t=>t.due&&t.due<today).length,'Долг прошлых недель','Включён в план','warn']];
 return [[rows.length,'Требует решения','Выбранные задачи'],[rows.filter(t=>!t.owner).length,'Без ответственного','Нужно назначение','warn'],[rows.filter(t=>!t.due).length,'Без срока','Не входят в недельный план','warn'],[rows.filter(t=>t.due&&t.due<today).length,'Просрочено','Нужен договорённый срок','warn']];
}
export function weeklyError(error){
 const message=String(error?.message||'');
 if(error?.name==='AbortError'||/timeout|timed out/i.test(message))return 'Google не ответил вовремя. Нажмите «Обновить», чтобы повторить загрузку.';
 if(error?.name==='SyntaxError')return 'В данных отчёта неверный формат. Проверьте архив в таблице и повторите обновление.';
 if(/fetch|network|load failed/i.test(message))return 'Не удалось связаться с Google. Проверьте соединение и нажмите «Обновить».';
 if(!message||!/[А-Яа-яЁё]/.test(message))return 'Не удалось загрузить отчёт. Повторите обновление. Если ошибка повторится, проверьте доступ и данные архива.';
 return message;
}
