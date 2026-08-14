export function uniqueBy(items = [], keyFn = (item) => item) {
  const seen = new Set();

  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chunk(items = [], size = 1) {
  const result = [];
  const safeSize = Math.max(1, Number(size) || 1);

  for (let index = 0; index < items.length; index += safeSize) {
    result.push(items.slice(index, index + safeSize));
  }

  return result;
}
