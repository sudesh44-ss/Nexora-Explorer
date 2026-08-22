const STORAGE_PREFIX = "myFileExplorer:";

export function saveValue(key, value) {
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
}

export function loadValue(key, fallback = null) {
  try {
    const value = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function removeValue(key) {
  localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}
