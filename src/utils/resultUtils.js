export function isSuccess(result) {
  return Boolean(result?.success);
}

export function isFailure(result) {
  return result?.success === false;
}

export function getResultData(result, fallback = null) {
  return result?.data ?? result ?? fallback;
}
