import type { Cell, Notebook, Uuid } from "catcolab-document-types";

/** Status of a live notebook cell relative to a diff baseline. */
export type CellDiffStatus = "added" | "changed";

/** Diff of a notebook against a baseline version of the same notebook.

The notebook editor renders a diff but never computes one: whoever embeds the
editor (e.g. the Patchwork wrapper) decides which baseline to compare against
and passes the result in. When no diff is passed, the editor renders normally.
 */
export type NotebookDiff<T> = {
    /** Diff status of live cells, keyed by cell id. Unchanged cells are absent. */
    cellStatus: ReadonlyMap<Uuid, CellDiffStatus>;

    /** Baseline cells that were deleted from the live notebook, grouped by
    anchor: the id of the closest preceding baseline cell that still exists in
    the live notebook, or `null` for cells deleted from the start. */
    deletedCells: ReadonlyMap<Uuid | null, Cell<T>[]>;

    /** Baseline content of a changed formal cell, for before/after displays. */
    baselineContent: (cellId: Uuid) => T | undefined;
};

/** Compute the diff between two versions of a notebook.

Cells are matched by their stable ids. Both notebooks must be plain JavaScript
values (not Automerge or Solid proxies); deleted cells in the result alias
cells of `before`.
 */
export function diffNotebooks<T>(before: Notebook<T>, after: Notebook<T>): NotebookDiff<T> {
    const cellStatus = new Map<Uuid, CellDiffStatus>();
    const baselineFormalContent = new Map<Uuid, T>();
    for (const cellId of after.cellOrder) {
        const afterCell = after.cellContents[cellId];
        const beforeCell = before.cellContents[cellId];
        if (!afterCell) {
            continue;
        }
        if (!beforeCell) {
            cellStatus.set(cellId, "added");
        } else if (!deepEqual(beforeCell, afterCell)) {
            cellStatus.set(cellId, "changed");
            if (beforeCell.tag === "formal") {
                baselineFormalContent.set(cellId, beforeCell.content);
            }
        }
    }

    const liveIds = new Set(after.cellOrder);
    const deletedCells = new Map<Uuid | null, Cell<T>[]>();
    let anchor: Uuid | null = null;
    for (const cellId of before.cellOrder) {
        if (liveIds.has(cellId)) {
            anchor = cellId;
            continue;
        }
        const cell = before.cellContents[cellId];
        if (!cell) {
            continue;
        }
        const group = deletedCells.get(anchor);
        if (group) {
            group.push(cell);
        } else {
            deletedCells.set(anchor, [cell]);
        }
    }

    return {
        cellStatus,
        deletedCells,
        baselineContent: (cellId) => baselineFormalContent.get(cellId),
    };
}

/** Structural equality on plain JSON-like values. */
function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
        return false;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            return false;
        }
        return a.every((item, i) => deepEqual(item, b[i]));
    }
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    if (aKeys.length !== Object.keys(bRecord).length) {
        return false;
    }
    return aKeys.every(
        (key) => Object.hasOwn(bRecord, key) && deepEqual(aRecord[key], bRecord[key]),
    );
}
