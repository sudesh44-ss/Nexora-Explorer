export function getNextSortState(
  currentField,
  currentOrder,
  clickedField,
) {
  if (
    currentField ===
    clickedField
  ) {
    return {
      sortBy: clickedField,
      sortOrder:
        currentOrder === "asc"
          ? "desc"
          : "asc",
    };
  }

  return {
    sortBy: clickedField,
    sortOrder: "asc",
  };
}

export function getSortIndicator(
  sortBy,
  sortOrder,
  field,
) {
  if (sortBy !== field) {
    return "";
  }

  return sortOrder === "asc"
    ? " ▲"
    : " ▼";
}