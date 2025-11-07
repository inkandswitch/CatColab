import * as Automerge from "@automerge/automerge";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import {
    Annotation,
    DiffAnnotation,
    Pointer,
} from "@patchwork/sdk/annotations";
import { Cell, Uuid } from "catlog-wasm";
import React, { useEffect, useRef } from "react";
import { Component } from "solid-js";
import { createComponent, render } from "solid-js/web";
import { AnalysisDoc } from "./analysis_datatype";
import { ModelDoc } from "./model_datatype";
import "./annotations.css";

export class CellPointer<D extends ModelDoc | AnalysisDoc>
    implements Pointer<D, Uuid, any>
{
    constructor(readonly doc: D, readonly target: Uuid) {}

    get value(): any {
        return this.doc.notebook.cellContents[this.target];
    }
    get sortValue(): string | number | (string | number)[] {
        return this.target;
    }
    doesOverlap(pointer: Pointer<D, Uuid, any>): boolean {
        return this.target === pointer.target;
    }
}

export const patchesToAnnotation = <D extends ModelDoc | AnalysisDoc>(
    docBefore: D,
    docAfter: D,
    patches: Automerge.Patch[]
): DiffAnnotation<D, Uuid, Cell<unknown>>[] => {
    const annotations: DiffAnnotation<D, Uuid, Cell<unknown>>[] = [];

    const changedCellIds = new Set<Uuid>();

    patches.forEach((patch) => {
        if (patch.path[0] !== "notebook") {
            return;
        }

        // Only track changes to cellContents (actual content modifications/additions/deletions)
        // Ignore cellOrder changes (reordering)
        if (patch.path[1] === "cellContents") {
            const cellId = patch.path[2] as Uuid;

            if (changedCellIds.has(cellId)) {
                return;
            }

            const cellBefore = docBefore.notebook.cellContents[cellId];
            const cellAfter = docAfter.notebook.cellContents[cellId];

            if (patch.action === "del") {
                // Cell was deleted
                if (cellBefore) {
                    changedCellIds.add(cellId);
                    annotations.push({
                        type: "deleted",
                        pointer: new CellPointer(docBefore, cellId),
                    });
                }
            } else if (patch.action === "put" || patch.action === "splice") {
                if (cellBefore && cellAfter) {
                    // Cell content was modified
                    changedCellIds.add(cellId);
                    annotations.push({
                        type: "changed",
                        before: new CellPointer(docBefore, cellId),
                        after: new CellPointer(docAfter, cellId),
                    });
                } else if (cellAfter && !cellBefore) {
                    // Cell was added
                    changedCellIds.add(cellId);
                    annotations.push({
                        type: "added",
                        pointer: new CellPointer(docAfter, cellId),
                    });
                }
            }
        }
    });

    return annotations;
};

export type CellAnnotationsViewProps = {
    repo: Repo;
    annotations: Annotation<ModelDoc | AnalysisDoc, Uuid, Cell<unknown>>[];
    docUrl: AutomergeUrl;
};

export function CellAnnotationsViewWrapper({
    annotations,
    docUrl,
    CellAnnotationsView,
}: {
    annotations: Annotation<ModelDoc | AnalysisDoc, Uuid, Cell<unknown>>[];
    docUrl: AutomergeUrl;
    CellAnnotationsView: Component<CellAnnotationsViewProps>;
}) {
    const solidContainerRef = useRef<HTMLDivElement>(null);
    const solidDisposeRef = useRef<(() => void) | null>(null);
    const repo = useRepo();

    useEffect(() => {
        if (solidContainerRef.current) {
            // Clean up previous render
            if (solidDisposeRef.current) {
                solidDisposeRef.current();
            }

            solidDisposeRef.current = render(
                () =>
                    createComponent(CellAnnotationsView, {
                        repo,
                        annotations,
                        docUrl,
                    }),
                solidContainerRef.current
            );
        }

        // Cleanup on unmount
        return () => {
            if (solidDisposeRef.current) {
                solidDisposeRef.current();
                solidDisposeRef.current = null;
            }
        };
    }, [annotations, repo, docUrl, CellAnnotationsView]);

    // We use React.createElement here to avoid bringing in React's JSX transform.
    // We had some trouble with combining both solid and react JSX in one build.
    return React.createElement("div", { ref: solidContainerRef });
}
