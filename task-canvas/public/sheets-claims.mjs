// Sheets validates a supplied namedRangeId as unique. Claim + append are one
// atomic batch, so concurrent clients cannot append the same task twice.
// This is a create fence, not a lock on subsequent cell edits.
export async function taskClaim(id, sheetId, cryptoApi=globalThis.crypto) {
  if(!cryptoApi?.subtle)throw new Error('Браузер не поддерживает защищённое сохранение. Правки остались на устройстве.');
  const bytes=new TextEncoder().encode(String(id));
  const hash=Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  return {addNamedRange:{namedRange:{namedRangeId:'gengroup_task_'+hash,name:'_GENGROUP_TASK_'+hash,range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:18,endColumnIndex:19}}}};
}
export const isClaimCollision=error=>error?.status===400&&/addNamedRange/i.test(error.message||'')&&/already exists/i.test(error.message||'');
