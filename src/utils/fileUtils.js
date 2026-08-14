export function getFileExtension(name = "") {
  const index = name.lastIndexOf(".");
  if (index <= 0) return "";
  return name.slice(index + 1).toLowerCase();
}

export function getFileName(path = "") {
  const normalized = String(path).replace(/[\\/]+$/, "");
  return normalized.slice(Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/")) + 1);
}

export function isFile(item) {
  return Boolean(item && !item.isDirectory);
}

export function isFolder(item) {
  return Boolean(item?.isDirectory);
}
