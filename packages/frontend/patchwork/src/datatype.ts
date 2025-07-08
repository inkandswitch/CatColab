import * as A from "@automerge/automerge";
import {
    HasVersionControlMetadata,
    Annotation,
    TextPatch,
    DecodedChangeWithMetadata,
} from "@patchwork/sdk/versionControl";
import { type DataTypeImplementation, initFrom } from "@patchwork/sdk";
import { Cell } from "catlog-wasm";

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
    return patches.flatMap((patch) => {
        if (
            patch.path.length !== 3 ||
            patch.path[0] !== "notebook" ||
            patch.path[1] !== "cells"
        ) {
            return [];
        }

        const cellIndex = patch.path[2] as number;

        switch (patch.action) {
            case "del": {
                const cell = docBefore.notebook.cells[cellIndex];
                return [
                    {
                        type: "deleted",
                        deleted: cell,
                        anchor: cell.id,
                    } as Annotation<CelAnchor, Cell>,
                ];
            }
            case "insert": {
                const cell = doc.notebook.cells[cellIndex];
                return [
                    {
                        type: "added",
                        added: cell,
                        anchor: cell.id,
                    } as Annotation<CelAnchor, Cell>,
                ];
            }
            // todo: support changed
        }

        return [];
    });
};

const valueOfAnchor = (doc: Doc, anchor: CelAnchor): Cell => {
    return doc.notebook.cells.find((cell) => cell.id === anchor) as Cell;
};

const sortAnchorsBy = (doc: Doc, anchor: CelAnchor): number => {
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

export const dataType: DataTypeImplementation<Doc, CelAnchor> = {
    init,
    getTitle,
    setTitle,
    markCopy,
    sortAnchorsBy,
    valueOfAnchor,
    patchesToAnnotations,
    includePatchInChangeGroup,
};
