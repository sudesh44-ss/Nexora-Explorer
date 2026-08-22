export function hasInvalidWindowsFilenameCharacters(
  name,
) {
  return /[<>:"/\\|?*]/.test(
    name,
  );
}

export function isValidFileName(
  name,
) {
  if (
    typeof name !== "string"
  ) {
    return false;
  }

  const value = name.trim();

  if (!value) {
    return false;
  }

  return !hasInvalidWindowsFilenameCharacters(
    value,
  );
}