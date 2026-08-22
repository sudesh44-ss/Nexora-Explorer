/*
 * ============================================================
 * File Extension Visibility Utility
 * ============================================================
 *
 * Purpose:
 * - File extensions show/hide karna
 * - Original filename ko preserve karna
 * - Extension ko safely identify karna
 * - Hidden extension ke saath display name banana
 * - Rename ke waqt original filename preserve karna
 *
 * IMPORTANT:
 * Ye utility actual filesystem filename ko change nahi karti.
 * Sirf Explorer UI me display hone wala naam control karti hai.
 * ============================================================
 */

/**
 * Check whether an item is a file.
 */
export function isFile(item) {
  return Boolean(item && !item.isDirectory);
}

/**
 * Check whether an item is a folder.
 */
export function isFolder(item) {
  return Boolean(item && item.isDirectory);
}

/**
 * Get the extension from a filename.
 *
 * Examples:
 *
 * photo.jpg       -> ".jpg"
 * document.pdf    -> ".pdf"
 * archive.tar.gz  -> ".gz"
 * README          -> ""
 * .gitignore      -> ""
 * .env.local      -> ".local"
 */
export function getExtension(name) {
  if (typeof name !== "string") {
    return "";
  }

  const cleanName = name.trim();

  if (!cleanName) {
    return "";
  }

  const lastDot = cleanName.lastIndexOf(".");

  /*
   * No extension.
   */
  if (lastDot === -1) {
    return "";
  }

  /*
   * ".gitignore" type filename ko extension nahi maanenge.
   */
  if (lastDot === 0) {
    return "";
  }

  /*
   * "file." ko extension nahi maanenge.
   */
  if (lastDot === cleanName.length - 1) {
    return "";
  }

  return cleanName.substring(lastDot);
}

/**
 * Get filename without extension.
 *
 * Examples:
 *
 * photo.jpg    -> "photo"
 * document.pdf -> "document"
 * README       -> "README"
 */
export function getNameWithoutExtension(name) {
  if (typeof name !== "string") {
    return "";
  }

  const extension = getExtension(name);

  if (!extension) {
    return name;
  }

  return name.slice(0, -extension.length);
}

/**
 * Get filename and extension separately.
 */
export function splitFilename(name) {
  const extension = getExtension(name);

  if (!extension) {
    return {
      name: name || "",
      extension: "",
    };
  }

  return {
    name: name.slice(0, -extension.length),
    extension,
  };
}

/**
 * Get extension in uppercase.
 *
 * Example:
 * ".jpg" -> "JPG"
 */
export function getExtensionLabel(name) {
  const extension = getExtension(name);

  if (!extension) {
    return "";
  }

  return extension.substring(1).toUpperCase();
}

/**
 * Generate the name displayed in Explorer.
 *
 * showExtensions = true:
 *     "photo.jpg"
 *
 * showExtensions = false:
 *     "photo"
 *
 * Folders are always returned unchanged.
 */
export function getDisplayName(item, showExtensions = true) {
  if (!item || typeof item.name !== "string") {
    return "";
  }

  /*
   * Folder names do not have their extension hidden.
   */
  if (item.isDirectory) {
    return item.name;
  }

  if (showExtensions) {
    return item.name;
  }

  return getNameWithoutExtension(item.name);
}

/**
 * Apply display name to an Explorer item.
 *
 * IMPORTANT:
 * Original "name" property remains untouched.
 */
export function withDisplayName(item, showExtensions = true) {
  if (!item) {
    return item;
  }

  return {
    ...item,
    displayName: getDisplayName(item, showExtensions),
  };
}

/**
 * Apply display names to multiple items.
 */
export function withDisplayNames(items, showExtensions = true) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) =>
    withDisplayName(item, showExtensions),
  );
}

/**
 * Return a rename value while preserving the existing extension.
 *
 * Example:
 *
 * Existing:
 *     photo.jpg
 *
 * User enters:
 *     vacation
 *
 * Result:
 *     vacation.jpg
 *
 * If the user explicitly enters an extension:
 *
 * Existing:
 *     photo.jpg
 *
 * User enters:
 *     vacation.png
 *
 * Result:
 *     vacation.png
 */
export function buildRenamedFilename(
  originalName,
  newName,
  preserveExtension = true,
) {
  if (typeof originalName !== "string") {
    return newName || "";
  }

  if (typeof newName !== "string") {
    return originalName;
  }

  const trimmedName = newName.trim();

  if (!trimmedName) {
    return originalName;
  }

  /*
   * Extension preservation disabled.
   */
  if (!preserveExtension) {
    return trimmedName;
  }

  const originalExtension = getExtension(originalName);

  /*
   * Original file had no extension.
   */
  if (!originalExtension) {
    return trimmedName;
  }

  /*
   * User already supplied an extension.
   *
   * Example:
   * original = photo.jpg
   * new      = vacation.png
   */
  const newExtension = getExtension(trimmedName);

  if (newExtension) {
    return trimmedName;
  }

  /*
   * User entered only the filename.
   */
  return `${trimmedName}${originalExtension}`;
}

/**
 * Check whether a user-entered name already contains
 * an extension.
 */
export function hasExtension(name) {
  return Boolean(getExtension(name));
}

/**
 * Check whether a filename is extensionless.
 */
export function hasNoExtension(name) {
  return !hasExtension(name);
}

/**
 * Get the full extension chain.
 *
 * Example:
 *
 * archive.tar.gz -> ".tar.gz"
 *
 * This is useful for archive-style filenames.
 */
export function getFullExtension(name) {
  if (typeof name !== "string") {
    return "";
  }

  const cleanName = name.trim();

  if (!cleanName) {
    return "";
  }

  const firstDot = cleanName.indexOf(".");

  /*
   * Hidden files such as .gitignore.
   */
  if (firstDot === 0) {
    return "";
  }

  if (firstDot === -1) {
    return "";
  }

  return cleanName.substring(firstDot);
}

/**
 * Get only the final extension.
 *
 * archive.tar.gz -> ".gz"
 */
export function getFinalExtension(name) {
  return getExtension(name);
}

/**
 * Get a clean filename for search/display purposes.
 *
 * Example:
 *
 * "photo.jpg" + extensions hidden
 * -> "photo"
 */
export function getSearchDisplayName(
  item,
  showExtensions = true,
) {
  if (!item || typeof item.name !== "string") {
    return "";
  }

  return getDisplayName(item, showExtensions);
}

/**
 * Create extension visibility settings.
 */
export function createExtensionSettings(
  showExtensions = true,
) {
  return {
    showExtensions: Boolean(showExtensions),
  };
}

/**
 * Toggle extension visibility.
 */
export function toggleExtensionVisibility(
  currentValue,
) {
  return !currentValue;
}

/**
 * Validate extension visibility setting.
 */
export function normalizeExtensionVisibility(
  value,
  fallback = true,
) {
  if (typeof value === "boolean") {
    return value;
  }

  return Boolean(fallback);
}

/**
 * Prepare items for Explorer rendering.
 */
export function prepareItemsForDisplay(
  items,
  showExtensions = true,
) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    ...item,
    displayName: getDisplayName(
      item,
      showExtensions,
    ),
  }));
}

/**
 * Get information about a filename.
 */
export function getFilenameInfo(name) {
  const extension = getExtension(name);

  return {
    originalName: name || "",
    baseName: getNameWithoutExtension(name),
    extension,
    extensionLabel: extension
      ? extension.substring(1).toUpperCase()
      : "",
    hasExtension: Boolean(extension),
    fullExtension: getFullExtension(name),
  };
}

/**
 * Public constants.
 */
export const EXTENSION_VISIBILITY = {
  SHOW: true,
  HIDE: false,
};