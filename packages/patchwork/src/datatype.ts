import * as A from "@automerge/automerge";
import {
    HasVersionControlMetadata,
    Annotation,
    TextPatch,
    DecodedChangeWithMetadata,
} from "@patchwork/sdk/versionControl";
import { type DataTypeImplementation, initFrom } from "@patchwork/sdk";
import { Cell, Uuid } from "catlog-wasm";

// SCHEMA

export type Doc = HasVersionControlMetadata<unknown, unknown> & {
    name: string;
    theory: string;
    type: string;
    notebook: {
        cells: Cell<unknown>[];
    };
};

export const patchesToAnnotations = (
    doc: Doc,
    docBefore: Doc,
    patches: A.Patch[]
) => {
    const changedCells = new Set<Uuid>();
    const annotations: Annotation<Uuid, Cell<unknown>>[] = [];

    patches.forEach((patch) => {
        if (patch.path[0] !== "notebook" || patch.path[1] !== "cells") {
            return;
        }

        const cellIndex = patch.path[2] as number;

        if (patch.path.length === 3) {
            switch (patch.action) {
                case "del": {
                    const cell = docBefore.notebook.cells[cellIndex];
                    annotations.push({
                        type: "deleted",
                        deleted: cell,
                        anchor: cell.id,
                    } as Annotation<Uuid, Cell<unknown>>);
                    return;
                }
                case "insert": {
                    changedCells.add(doc.notebook.cells[cellIndex].id);
                    const cell = doc.notebook.cells[cellIndex];
                    annotations.push({
                        type: "added",
                        added: cell,
                        anchor: cell.id,
                    } as Annotation<Uuid, Cell<unknown>>);
                    return;
                }
                // todo: support changed
            }
        }

        switch (patch.action) {
            case "insert":
            case "splice": {
                const after = doc.notebook.cells[cellIndex];

                if (changedCells.has(after.id)) {
                    return;
                }

                const before = docBefore.notebook.cells.find(
                    (cell) => cell.id === after.id
                );

                if (!before) {
                    annotations.push({
                        type: "added",
                        added: after,
                        anchor: after.id,
                    } as Annotation<Uuid, Cell<unknown>>);
                    changedCells.add(after.id);
                    return;
                }

                annotations.push({
                    type: "changed",
                    before: before,
                    after: after,
                    anchor: after.id,
                } as Annotation<Uuid, Cell<unknown>>);
                changedCells.add(after.id);
                return;
            }
        }
    });

    return annotations;
};

const valueOfAnchor = (doc: Doc, anchor: Uuid): Cell<unknown> => {
    return doc.notebook.cells.find(
        (cell) => cell.id === anchor
    ) as Cell<unknown>;
};

const sortAnchorsBy = (doc: Doc, anchor: Uuid): number => {
    return doc.notebook.cells.findIndex((cell) => cell.id === anchor);
};

const includePatchInChangeGroup = (patch: A.Patch | TextPatch) => {
    return patch.path[0] === "notebook";
};

// We filter conservatively with a deny-list because dealing with edits on a nested schema is annoying.
// Would be better to filter with an allow-list but that's tricky with current Automerge APIs.
export const includeChangeInHistory = (doc: Doc) => {
    const metadataObjIds = [
        "branchMetadata",
        "tags",
        "diffBase",
        //"discussions", filter out comment changes for now because we don't surface them in the history
        "changeGroupSummaries",
    ].map((path) => A.getObjectId(doc, path));

    return (decodedChange: DecodedChangeWithMetadata) => {
        return decodedChange.ops.every(
            (op) => !metadataObjIds.includes(op.obj)
        );
    };
};

export const markCopy = (doc: Doc) => {
    doc.name = "Copy of " + doc.name;
};

const setTitle = async (doc: Doc, title: string) => {
    doc.name = title;
};

const getTitle = async (doc: Doc) => {
    return doc.name || "CatColab Model";
};

export const init = (doc: Doc) => {
    initFrom(doc, {
        name: "CatColab Model",
        theory: "simple-olog",
        type: "model",
        notebook: {
            cells: [],
        },
    });
};

export const dataType: DataTypeImplementation<Doc, Uuid, Cell<unknown>> = {
    init,
    getTitle,
    setTitle,
    markCopy,
    sortAnchorsBy,
    valueOfAnchor,
    patchesToAnnotations,
    includePatchInChangeGroup,
};
