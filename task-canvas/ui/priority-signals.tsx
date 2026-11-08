import React from 'react';
import {Flag,Clock3,Check,X,Inbox,Timer,CalendarClock,UsersRound,Pause,CheckCheck,CircleX} from 'lucide-react';

// ZNANIYA reference §§0,3.8,7: color has a role, statuses have separate colors.
export function PrioritySignals({group}:any) {
  const important=['do','plan'].includes(group.id),urgent=['do','delegate'].includes(group.id);
  if(['do','plan','delegate','later'].includes(group.id))return <span className="priority-signals">
    <span className={important?'signal-important':'signal-quiet'}><Flag size={12}/>{important?'Важно':'Не важно'}</span>
    <span className={urgent?'signal-urgent':'signal-quiet'}><Clock3 size={12}/>{urgent?'Срочно':'Не срочно'}</span>
  </span>;
  const Icon=group.id==='status:done'?Check:group.id==='status:cancelled'?X:Inbox;
  return <span className={`priority-signals ${group.id==='status:done'?'signal-done':group.id==='status:cancelled'?'signal-cancelled':'signal-quiet'}`}><span><Icon size={12}/>{group.id==='inbox'?'Без приоритета':group.subtitle}</span></span>;
}

export function PriorityEmblem({id}:any){
 const Icon={do:Timer,plan:CalendarClock,delegate:UsersRound,later:Pause,inbox:Inbox,'status:done':CheckCheck,'status:cancelled':CircleX}[id]||Inbox;
 return <span className="priority-emblem" data-kind={id} aria-hidden="true"><Icon size={23} strokeWidth={1.7}/></span>;
}
