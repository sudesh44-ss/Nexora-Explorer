export function throttle(fn, delay = 100) {
  let lastCall = 0;
  let timeout = null;

  return (...args) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timeout) clearTimeout(timeout);
      timeout = null;
      lastCall = now;
      fn(...args);
      return;
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        lastCall = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}
