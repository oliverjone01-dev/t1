export function parseAssignee(value) {
  const name = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name) return "";
  if (
    name.length > 80 ||
    /;|\u2014|\u2013|\s-\s|->|\u2192|\sи\s|не указан|исполнитель|инициатор|адресат/i.test(
      name,
    )
  )
    return null;
  return /^[\p{L} -]+$/u.test(name) ? name : null;
}
