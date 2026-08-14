export function capitalize(value = "") {
  const text = String(value);
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export function truncate(value = "", maxLength = 50) {
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function normalizeText(value = "") {
  return String(value).trim().toLowerCase();
}
