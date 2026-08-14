export function pathLabel(filePath) {
  if (!filePath) {
    return "This PC";
  }

  const clean =
    filePath.replace(
      /[\\/]+$/,
      "",
    );

  return (
    clean.substring(
      clean.lastIndexOf("\\") +
        1,
    ) || clean
  );
}

export function extensionOf(item) {
  if (!item?.isDirectory) {
    const name =
      item?.name || "";

    const index =
      name.lastIndexOf(".");

    return index === -1
      ? ""
      : name
          .substring(index)
          .toLowerCase();
  }

  return "";
}