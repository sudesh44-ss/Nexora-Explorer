export function pick(object, keys = []) {
  return keys.reduce((result, key) => {
    if (object && key in object) result[key] = object[key];
    return result;
  }, {});
}

export function omit(object, keys = []) {
  const result = { ...(object || {}) };
  for (const key of keys) delete result[key];
  return result;
}
