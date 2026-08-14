export function filterItems({
  items = [],
  searchResults = [],
  deepSearch = false,
  searchQuery = "",
  filterType = "all",
  matchesFilter,
}) {
  const baseItems =
    deepSearch &&
    searchQuery.trim()
      ? searchResults
      : items;

  const query =
    searchQuery
      .trim()
      .toLowerCase();

  return baseItems.filter(
    (item) => {
      const matchesText =
        item.name
          .toLowerCase()
          .includes(query);

      return (
        matchesText &&
        matchesFilter(
          item,
          filterType,
        )
      );
    },
  );
}

export function sortItems({
  items = [],
  sortBy,
  sortOrder = "asc",
}) {
  return [...items].sort(
    (a, b) => {
      // Folders first.
      if (
        a.isDirectory !==
        b.isDirectory
      ) {
        return a.isDirectory
          ? -1
          : 1;
      }

      let comparison = 0;

      if (sortBy === "name") {
        comparison =
          String(a.name || "")
            .toLowerCase()
            .localeCompare(
              String(
                b.name || "",
              ).toLowerCase(),
            );
      } else if (
        sortBy === "size"
      ) {
        comparison =
          Number(a.size || 0) -
          Number(b.size || 0);
      } else if (
        sortBy === "type"
      ) {
        comparison =
          String(
            a.type || "",
          )
            .toLowerCase()
            .localeCompare(
              String(
                b.type || "",
              ).toLowerCase(),
            );
      } else if (
        sortBy === "modified"
      ) {
        comparison =
          new Date(
            a.modified || 0,
          ).getTime() -
          new Date(
            b.modified || 0,
          ).getTime();
      } else if (
        sortBy === "created"
      ) {
        comparison =
          new Date(
            a.created || 0,
          ).getTime() -
          new Date(
            b.created || 0,
          ).getTime();
      }

      return sortOrder === "asc"
        ? comparison
        : -comparison;
    },
  );
}

export function getSelectedItems(
  items = [],
  selectedPaths = new Set(),
) {
  return items.filter(
    (item) =>
      selectedPaths.has(
        item.path,
      ),
  );
}

export function getSelectedItem(
  selectedItems = [],
) {
  return selectedItems.length === 1
    ? selectedItems[0]
    : null;
}

export function getBatchTransferItems(
  selectedItems = [],
) {
  return selectedItems.filter(
    (item) =>
      item &&
      typeof item.path ===
        "string",
  );
}