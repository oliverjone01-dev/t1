/** Keep planned rows in the page so a later Moscow date can reveal them without fabricated facts. */
export function novemberPeriodAttrs(from:string,today:string){
  return `data-nov-from="${from}"${from>today?' hidden':''}`;
}
