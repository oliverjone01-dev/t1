export const ACTIVE_MANAGERS = ['Юлия Лысанова','Татьяна Лакомова','Юлия Шура-Бура','Надежда Лобова','Татьяна Фомичева','Алёна Филатова','Алёна Кубанова'];
const norm = name => String(name || '').trim().toLocaleLowerCase('ru').replaceAll('ё','е');
export const canonicalManager = name => ACTIVE_MANAGERS.find(n => norm(n) === norm(name)) || name;
export function normalizeManagerSnapshot(data) {
  for (const key of ['deals','leads','prodItems']) for (const row of data[key] || []) row.mgr = canonicalManager(row.mgr);
  data.firedManagers = (data.firedManagers || []).filter(n => !ACTIVE_MANAGERS.includes(canonicalManager(n)));
  return data;
}
