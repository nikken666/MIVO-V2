"use client";

import { useMemo, useState } from "react";
import styles from "./CategoryPicker.module.css";

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number | null;
};

type CategoryPickerProps = {
  categories: CategoryNode[];
  name?: string;
  required?: boolean;
  rootSlug?: string;
};

function sortNodes(nodes: CategoryNode[]) {
  return [...nodes].sort((a, b) => {
    const orderA = a.sort_order ?? 999999;
    const orderB = b.sort_order ?? 999999;

    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export default function CategoryPicker({
  categories,
  name = "category_id",
  required = true,
  rootSlug = "vehicles-spare-parts-accessories",
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [draftPath, setDraftPath] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const categoryById = useMemo(
    () =>
      new Map(
        categories.map((category) => [category.id, category])
      ),
    [categories]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CategoryNode[]>();

    for (const category of categories) {
      const current = map.get(category.parent_id) || [];
      current.push(category);
      map.set(category.parent_id, current);
    }

    for (const [key, nodes] of map.entries()) {
      map.set(key, sortNodes(nodes));
    }

    return map;
  }, [categories]);

  const preferredRoot = useMemo(
    () => categories.find((category) => category.slug === rootSlug),
    [categories, rootSlug]
  );

  const roots = useMemo(() => {
    if (preferredRoot) return [preferredRoot];
    return childrenByParent.get(null) || [];
  }, [childrenByParent, preferredRoot]);

  function getChildren(id: string) {
    return childrenByParent.get(id) || [];
  }

  function buildPath(id: string) {
    const result: string[] = [];
    const visited = new Set<string>();
    let current = categoryById.get(id);

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      result.unshift(current.id);
      current = current.parent_id
        ? categoryById.get(current.parent_id)
        : undefined;
    }

    return result;
  }

  function pathText(path: string[]) {
    return path
      .map((id) => categoryById.get(id)?.name)
      .filter(Boolean)
      .join(" > ");
  }

  const selectedPath = selectedId ? buildPath(selectedId) : [];
  const selectedText = pathText(selectedPath);

  const columns = useMemo(() => {
    const result: CategoryNode[][] = [roots];

    for (const id of draftPath) {
      const children = getChildren(id);
      if (children.length > 0) result.push(children);
    }

    return result.slice(0, 4);
  }, [draftPath, roots, childrenByParent]);

  const selectedDraft =
    draftPath.length > 0
      ? categoryById.get(draftPath[draftPath.length - 1])
      : undefined;

  const selectedDraftChildren = selectedDraft
    ? getChildren(selectedDraft.id)
    : [];

  const canConfirm =
    Boolean(selectedDraft) && selectedDraftChildren.length === 0;

  const searchResults = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return [];

    return categories
      .filter((category) =>
        category.name.toLowerCase().includes(keyword)
      )
      .filter((category) => getChildren(category.id).length === 0)
      .slice(0, 30);
  }, [search, categories, childrenByParent]);

  function openModal() {
    const initialPath = selectedId
      ? buildPath(selectedId)
      : preferredRoot
        ? [preferredRoot.id]
        : [];

    setDraftPath(initialPath);
    setSearch("");
    setOpen(true);
  }

  function chooseNode(node: CategoryNode, columnIndex: number) {
    setDraftPath((current) => [
      ...current.slice(0, columnIndex),
      node.id,
    ]);
    setSearch("");
  }

  function chooseSearchResult(node: CategoryNode) {
    setDraftPath(buildPath(node.id));
    setSearch("");
  }

  function confirmSelection() {
    if (!canConfirm || !selectedDraft) return;

    setSelectedId(selectedDraft.id);
    setOpen(false);
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Category *</span>

      <input
        type="hidden"
        name={name}
        value={selectedId}
        required={required}
      />

      <button
        type="button"
        className={`${styles.trigger} ${
          selectedId ? styles.triggerSelected : ""
        }`}
        onClick={openModal}
      >
        <span>{selectedText || "Choose category"}</span>
        <span className={styles.chevron}>›</span>
      </button>

      {selectedText && (
        <div className={styles.breadcrumb}>{selectedText}</div>
      )}

      {open && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Choose category"
          >
            <header className={styles.modalHeader}>
              <h2>Edit Category</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setOpen(false)}
                aria-label="Close category selector"
              >
                ×
              </button>
            </header>

            <div className={styles.searchRow}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search category"
                autoFocus
              />
              <span>⌕</span>
            </div>

            {search.trim() ? (
              <div className={styles.searchResults}>
                {searchResults.length > 0 ? (
                  searchResults.map((category) => {
                    const resultPath = buildPath(category.id);

                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() =>
                          chooseSearchResult(category)
                        }
                      >
                        <strong>{category.name}</strong>
                        <span>{pathText(resultPath)}</span>
                      </button>
                    );
                  })
                ) : (
                  <p>No category found.</p>
                )}
              </div>
            ) : (
              <div className={styles.columns}>
                {columns.map((column, columnIndex) => (
                  <div
                    className={styles.column}
                    key={`column-${columnIndex}`}
                  >
                    {column.map((category) => {
                      const active =
                        draftPath[columnIndex] === category.id;
                      const hasChildren =
                        getChildren(category.id).length > 0;

                      return (
                        <button
                          type="button"
                          key={category.id}
                          className={
                            active ? styles.activeItem : ""
                          }
                          onClick={() =>
                            chooseNode(category, columnIndex)
                          }
                        >
                          <span>{category.name}</span>
                          {hasChildren && <b>›</b>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <footer className={styles.footer}>
              <div className={styles.currentSelection}>
                <span>The currently selected:</span>
                <strong>
                  {draftPath.length > 0
                    ? pathText(draftPath)
                    : "No category selected"}
                </strong>

                {selectedDraftChildren.length > 0 && (
                  <small>
                    Continue selecting until the final category.
                  </small>
                )}
              </div>

              <div className={styles.footerActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={styles.confirmButton}
                  disabled={!canConfirm}
                  onClick={confirmSelection}
                >
                  Confirm
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
