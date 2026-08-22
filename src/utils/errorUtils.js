export function getErrorMessage(error, fallback = "Something went wrong.") {
  if (typeof error === "string" && error.trim()) return error;
  if (error?.message) return error.message;
  if (error?.error) return String(error.error);
  return fallback;
}

export function normalizeResult(result, fallback = "Operation failed.") {
  if (result?.success === false) {
    return {
      ...result,
      error: result.error || fallback,
    };
  }

  return result || { success: false, error: fallback };
}
