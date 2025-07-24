import * as Automerge from "@automerge/automerge";
import {
    Pointer,
    AnnotationsPluginImplementation,
    Annotation,
    DiffAnnotation,
} from "@patchwork/sdk/annotations";
import { ModelDoc } from "./model_datatype";
import { AnalysisDoc } from "./analysis_datatype";
import { Cell, Uuid } from "catlog-wasm";
import {
    AnalysisAnnotationsView,
    ModelAnnotationsView,
} from "./annotations_view";

export class CellPointer<D extends ModelDoc | AnalysisDoc>
    implements Pointer<D, Uuid, any>
{
    constructor(readonly doc: D, readonly target: Uuid) {}

    get value(): any {
        return this.doc.notebook.cells.find((cell) => cell.id === this.target)!;
    }
    get sortValue(): string | number | (string | number)[] {
        return this.target;
    }
    doesOverlap(pointer: Pointer<D, Uuid, any>): boolean {
        return this.target === pointer.target;
    }
}

const patchesToAnnotation = <D extends ModelDoc | AnalysisDoc>(
    docBefore: D,
    docAfter: D,
    patches: Automerge.Patch[]
): DiffAnnotation<D, Uuid, Cell<unknown>>[] => {
    const annotations: DiffAnnotation<D, Uuid, Cell<unknown>>[] = [];

    const newCellIds = new Set<Uuid>();
    const changedCellIds = new Set<Uuid>();

    patches.forEach((patch) => {
        if (patch.path[0] !== "notebook" || patch.path[1] !== "cells") {
            return;
        }

        const cellIndex = patch.path[2] as number;

        switch (patch.action) {
            case "del": {
                const cellId = docBefore.notebook.cells[cellIndex].id;
                annotations.push({
                    type: "deleted",
                    pointer: new CellPointer(docBefore, cellId),
                });
                break;
            }
            case "put": {
                const cellId = docAfter.notebook.cells[cellIndex].id;
                const cellBefore = docBefore.notebook.cells.find(
                    (cell) => cell.id === cellId
                );
                if (cellBefore) {
                    if (changedCellIds.has(cellId)) {
                        break;
                    }

                    changedCellIds.add(cellId);
                    annotations.push({
                        type: "changed",
                        before: new CellPointer(docBefore, cellId),
                        after: new CellPointer(docAfter, cellId),
                    });
                } else {
                    if (newCellIds.has(cellId)) {
                        break;
                    }

                    newCellIds.add(cellId);
                    annotations.push({
                        type: "added",
                        pointer: new CellPointer(docAfter, cellId),
                    });
                }
                break;
            }
        }
    });

    return annotations;
};

export const AnalysisAnnotationsPlugin: AnnotationsPluginImplementation<
    AnalysisDoc,
    Uuid,
    Cell<unknown>
> = {
    patchesToAnnotation: patchesToAnnotation<AnalysisDoc>,
    AnnotationsView: AnalysisAnnotationsView,
};

export const ModelAnnotationsPlugin: AnnotationsPluginImplementation<
    ModelDoc,
    Uuid,
    Cell<unknown>
> = {
    patchesToAnnotation: patchesToAnnotation<ModelDoc>,
    AnnotationsView: ModelAnnotationsView,
};
