import * as A from "@automerge/automerge";
import type {
    HasVersionControlMetadata,
    Annotation,
    TextPatch,
    DecodedChangeWithMetadata,
} from "@patchwork/sdk/versionControl";
import {
    type DataTypeImplementation,
    type DocLink,
    initFrom,
} from "@patchwork/sdk";
import type { Cell, Uuid } from "catlog-wasm";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import type { AnalysisDoc } from "./analysis_datatype";
import { init as initAnalysis } from "./analysis_datatype";

// SCHEMA

export type ModelDoc = HasVersionControlMetadata<Uuid, Cell<unknown>> & {
    name: string;
    theory: string;
    type: string;
    notebook: {
        cellContents: Record<Uuid, Cell<unknown>>;
        cellOrder: Uuid[];
    };
    analysisDocUrl: AutomergeUrl;
    version: string;
};

export const patchesToAnnotations = (
    doc: ModelDoc,
    _docBefore: ModelDoc,
    patches: A.Patch[]
) => {
    const changedCells = new Set<Uuid>();
    const annotations: Annotation<Uuid, Cell<unknown>>[] = [];

    // hack: there seems to be a bug in Automerge where view doesn't return the correct version of the snapshot
    // ... but it works if we look up the heads in the history
    const headsBefore = A.getHeads(_docBefore);
    const docBefore = A.getHistory(doc).find(
        ({ change }) => change.hash === headsBefore[0]
    )?.snapshot;

    patches.forEach((patch) => {
        if (patch.path[0] !== "notebook") {
            return;
        }

        // Handle changes to cellOrder (additions/deletions)
        if (patch.path[1] === "cellOrder") {
            const cellIndex = patch.path[2] as number;

            if (patch.path.length === 3) {
                switch (patch.action) {
                    case "del": {
                        if (!docBefore) {
                            return;
                        }

                        const cellId = docBefore.notebook.cellOrder[cellIndex];
                        const cell = docBefore.notebook.cellContents[cellId];
                        annotations.push({
                            type: "deleted",
                            deleted: cell,
                            anchor: cellId,
                        } as Annotation<Uuid, Cell<unknown>>);
                        return;
                    }
                    case "insert": {
                        const cellId = doc.notebook.cellOrder[cellIndex];
                        changedCells.add(cellId);
                        const cell = doc.notebook.cellContents[cellId];
                        annotations.push({
                            type: "added",
                            added: cell,
                            anchor: cellId,
                        } as Annotation<Uuid, Cell<unknown>>);
                        return;
                    }
                }
            }
        }

        // Handle changes to cellContents (modifications)
        if (patch.path[1] === "cellContents") {
            const cellId = patch.path[2] as Uuid;

            switch (patch.action) {
                case "put":
                case "splice": {
                    const after = doc.notebook.cellContents[cellId];

                    if (changedCells.has(cellId)) {
                        return;
                    }

                    const before = docBefore?.notebook.cellContents[cellId];

                    if (!before) {
                        annotations.push({
                            type: "added",
                            added: after,
                            anchor: cellId,
                        } as Annotation<Uuid, Cell<unknown>>);
                        changedCells.add(cellId);
                        return;
                    }

                    annotations.push({
                        type: "changed",
                        before: before,
                        after: after,
                        anchor: cellId,
                    } as Annotation<Uuid, Cell<unknown>>);
                    changedCells.add(cellId);
                    return;
                }
            }
        }
    });

    return annotations;
};

const valueOfAnchor = (doc: ModelDoc, anchor: Uuid): Cell<unknown> => {
    return doc.notebook.cellContents[anchor];
};

const sortAnchorsBy = (doc: ModelDoc, anchor: Uuid): number => {
    return doc.notebook.cellOrder.findIndex((cellId) => cellId === anchor);
};

const includePatchInChangeGroup = (patch: A.Patch | TextPatch) => {
    return patch.path[0] === "notebook";
};

// We filter conservatively with a deny-list because dealing with edits on a nested schema is annoying.
// Would be better to filter with an allow-list but that's tricky with current Automerge APIs.
export const includeChangeInHistory = (doc: ModelDoc) => {
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

export const markCopy = (doc: ModelDoc) => {
    doc.name = `Copy of ${doc.name}`;
};

const setTitle = async (doc: ModelDoc, title: string) => {
    doc.name = title;
};

const getTitle = async (doc: ModelDoc) => {
    return doc.name || "CatColab Model";
};

export const init = (doc: ModelDoc, repo: Repo) => {
    const analysisDocHandle = repo.create<AnalysisDoc>();

    analysisDocHandle.change((doc) => {
        initAnalysis(doc);
    });

    initFrom(doc, {
        name: "CatColab Model",
        theory: "simple-olog",
        type: "model",
        notebook: {
            cellContents: {},
            cellOrder: [],
        },
        analysisDocUrl: analysisDocHandle.url,
        version: "1",
    });
};

const links = (doc: ModelDoc): DocLink[] => {
    return doc.analysisDocUrl
        ? [
              {
                  url: doc.analysisDocUrl,
                  name: "Analysis",
                  type: "catcolab-analysis",
              },
          ]
        : [];
};

export const dataType: DataTypeImplementation<ModelDoc, Uuid, Cell<unknown>> = {
    init,
    getTitle,
    setTitle,
    markCopy,
    sortAnchorsBy,
    valueOfAnchor,
    patchesToAnnotations,
    // includePatchInChangeGroup,
    links,
};
