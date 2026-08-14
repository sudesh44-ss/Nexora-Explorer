export const isWindows = typeof navigator !== "undefined"
  ? navigator.userAgent.toLowerCase().includes("windows")
  : false;

export const isMacOS = typeof navigator !== "undefined"
  ? navigator.userAgent.toLowerCase().includes("mac")
  : false;

export const isLinux = typeof navigator !== "undefined"
  ? navigator.userAgent.toLowerCase().includes("linux")
  : false;
