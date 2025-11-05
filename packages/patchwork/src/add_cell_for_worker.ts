import invariant from "tiny-invariant";

import type { DocHandle, Repo } from "@automerge/automerge-repo/slim";
import type { MorphismDecl, ObjectDecl } from "../../frontend/src/model";
import type { FormalCell, StemCell } from "../../frontend/src/notebook";
import type { ModelDoc } from "./model_datatype";
import type { ModelTypeMeta, Theory } from "../../frontend/src/theory";
import type {
    Cell,
    ModelJudgment,
    MorType,
    Notebook,
    NotebookCell,
    ObType,
} from "catlog-wasm";
import { v7 } from "uuid";

export namespace NotebookUtils {
    export function getCells<T>(notebook: Notebook<T>): Array<Cell<T>> {
        return notebook.cellOrder.map((cellId) =>
            getCellById(notebook, cellId)
        );
    }

    export function getFormalContent<T>(notebook: Notebook<T>): Array<T> {
        return getCells(notebook)
            .filter((cell) => cell.tag === "formal")
            .map((cell) => cell.content);
    }

    export function getCellById<T>(
        notebook: Notebook<T>,
        cellId: string
    ): NotebookCell<T> {
        const cell = notebook.cellContents[cellId];
        invariant(
            cell,
            () => `Failed to find notebook cell contents for cell '${cellId}'`
        );
        return cell;
    }

    export function getCellIdByIndex<T>(
        notebook: Notebook<T>,
        index: number
    ): string {
        const cellId = notebook.cellOrder[index];
        invariant(
            cellId,
            () => `Failed to find notebook cell id at index '${index}'`
        );
        return cellId;
    }

    export function getCellByIndex<T>(
        notebook: Notebook<T>,
        index: number
    ): NotebookCell<T> {
        const cellId = getCellIdByIndex(notebook, index);
        return getCellById(notebook, cellId);
    }
    export function tryGetCellByIndex<T>(
        notebook: Notebook<T>,
        index: number
    ): Cell<T> | null {
        const cellId = notebook.cellOrder[index];
        if (!cellId) {
            return null;
        }

        const cell = notebook.cellContents[cellId];
        if (!cell) {
            return null;
        }

        return cell;
    }

    export function insertCellAtIndex<T>(
        notebook: Notebook<T>,
        cell: Cell<T>,
        index: number
    ) {
        notebook.cellOrder.splice(index, 0, cell.id);
        notebook.cellContents[cell.id] = cell;
    }

    export function newStemCellAtIndex<T>(
        notebook: Notebook<T>,
        index: number
    ) {
        const newCell = newStemCell();
        insertCellAtIndex(notebook, newCell, index);
    }

    export function deleteCellAtIndex<T>(notebook: Notebook<T>, index: number) {
        const cellId = getCellIdByIndex(notebook, index);
        delete notebook.cellContents[cellId];
        notebook.cellOrder.splice(index, 1);
    }

    export function moveCellUp<T>(notebook: Notebook<T>, index: number) {
        if (index <= 0) {
            return;
        }

        const [cellIdToMoveUp] = notebook.cellOrder.splice(index, 1);
        invariant(
            cellIdToMoveUp,
            () => `Failed to remove cellId at index '${index}'`
        );
        notebook.cellOrder.splice(index - 1, 0, cellIdToMoveUp);
    }

    export function moveCellDown<T>(notebook: Notebook<T>, index: number) {
        if (index >= notebook.cellOrder.length - 1) {
            return;
        }

        const [cellIdToMoveUp] = notebook.cellOrder.splice(index, 1);
        invariant(
            cellIdToMoveUp,
            () => `Failed to remove cellId at index '${index}'`
        );
        notebook.cellOrder.splice(index + 1, 0, cellIdToMoveUp);
    }

    export function moveCellByIndex<T>(
        notebook: Notebook<T>,
        fromIndex: number,
        toIndex: number
    ) {
        const [cellId] = notebook.cellOrder.splice(fromIndex, 1);
        invariant(
            cellId,
            () => `Failed to move cell from index '${fromIndex}'`
        );
        notebook.cellOrder.splice(toIndex, 0, cellId);
    }

    export function hasFormalCells<T>(notebook: Notebook<T>): boolean {
        return notebook.cellOrder.some(
            (cellId) => notebook.cellContents[cellId]?.tag === "formal"
        );
    }

    export function numCells<T>(notebook: Notebook<T>): number {
        return notebook.cellOrder.length;
    }

    function duplicateCell<T>(
        cell: Cell<T>,
        duplicateFn?: (cellContent: T) => T
    ): Cell<T> {
        switch (cell.tag) {
            case "formal": {
                const content = (duplicateFn ?? structuredClone)(cell.content);
                return newFormalCell(content);
            }
            case "rich-text":
                throw new Error("Rich text cells may not be duplicated");
            case "stem":
                return newStemCell();
            default:
                // assertExhaustive(cell);
                throw new Error(`Unknown cell tag`);
        }
    }

    export function duplicateCellAtIndex<T>(
        notebook: Notebook<T>,
        index: number,
        duplicateFn?: (cellContent: T) => T
    ) {
        const cell = getCellByIndex(notebook, index);
        const newCell = duplicateCell(cell, duplicateFn);
        insertCellAtIndex(notebook, newCell, index + 1);
    }

    export function appendCell<T>(notebook: Notebook<T>, cell: Cell<T>) {
        notebook.cellOrder.push(cell.id);
        notebook.cellContents[cell.id] = cell;
    }

    export function mutateCellContentById<T>(
        notebook: Notebook<T>,
        cellId: string,
        mutator: (cellContent: T) => void
    ) {
        const cell = getCellById(notebook, cellId);
        invariant(
            cell.tag === "formal",
            () =>
                `Only formal cells may be mutated. cell.id: '${cell.id}', cell.tag: '${cell.tag}'`
        );
        mutator(cell.content);
    }
}

/** Creates a new stem cell. */
export const newStemCell = (): StemCell => ({
    tag: "stem",
    id: v7(),
});

/** Creates a formal cell with the given content. */
export const newFormalCell = <T>(content: T): FormalCell<T> => ({
    tag: "formal",
    id: v7(),
    content: content,
});

/** Create a new object declaration with the given object type. */
export const newObjectDecl = (obType: ObType): ObjectDecl => ({
    tag: "object",
    id: v7(),
    name: "",
    obType,
});

/** Create a new morphism declaration with the given morphism type. */
export const newMorphismDecl = (morType: MorType): MorphismDecl => ({
    tag: "morphism",
    id: v7(),
    name: "",
    morType,
    dom: null,
    cod: null,
});

const theoriesCache = new Map<string, Theory>();
export const makeTheoriesCache = (stdTheories: any) => {
    // Preload all theories at module initialization time
    const preloadPromise = (async () => {
        for (const meta of stdTheories.allMetadata()) {
            try {
                const theory = await stdTheories.get(meta.id);
                theoriesCache.set(meta.id, theory);
            } catch (e) {
                console.error(`Failed to preload theory ${meta.id}:`, e);
            }
        }
    })();
    return preloadPromise;
};

const modelCellConstructor = (
    meta: ModelTypeMeta,
    theory: Theory,
    doc: ModelDoc
) => {
    const { name, description, shortcut } = meta;
    return {
        name,
        description,
        shortcut,
        construct() {
            if (meta.tag === "ObType") {
                const cell = newObjectDecl(meta.obType);
                // Set default name based on type name
                cell.name = name;
                return newFormalCell(cell);
            } else {
                const cell = newMorphismDecl(meta.morType);
                // Set default name based on type name, unless preferUnnamed
                if (!meta.preferUnnamed) {
                    cell.name = name;
                }

                // Try to populate domain and codomain with first available objects
                const domType = theory.theory.src(meta.morType);
                const codType = theory.theory.tgt(meta.morType);

                const formalContent = NotebookUtils.getFormalContent(
                    doc.notebook
                ) as ModelJudgment[];
                const availableObjects = formalContent.filter(
                    (j): j is ObjectDecl => j.tag === "object"
                );

                // Find first object matching domain type
                const domMatch = availableObjects.find((obj) =>
                    objectTypeMatches(obj.obType, domType)
                );
                if (domMatch) {
                    const basicOb = {
                        tag: "Basic" as const,
                        content: domMatch.id,
                    };
                    // Wrap in App if there's a domain apply operation
                    if (meta.domain?.apply) {
                        // Get the type of the operation's argument
                        const argType = theory.theory.dom(meta.domain.apply);
                        // The argument should be a list, so wrap in List structure
                        const listOb = {
                            tag: "List" as const,
                            content: {
                                modality:
                                    argType.tag === "ModeApp"
                                        ? argType.content.modality
                                        : "SymmetricList",
                                objects: [basicOb],
                            },
                        };
                        cell.dom = {
                            tag: "App" as const,
                            content: {
                                op: meta.domain.apply,
                                ob: listOb,
                            },
                        };
                    } else {
                        cell.dom = basicOb;
                    }
                }

                // Find first object matching codomain type
                const codMatch = availableObjects.find((obj) =>
                    objectTypeMatches(obj.obType, codType)
                );
                if (codMatch) {
                    const basicOb = {
                        tag: "Basic" as const,
                        content: codMatch.id,
                    };
                    // Wrap in App if there's a codomain apply operation
                    if (meta.codomain?.apply) {
                        // Get the type of the operation's argument
                        const argType = theory.theory.dom(meta.codomain.apply);
                        // The argument should be a list, so wrap in List structure
                        const listOb = {
                            tag: "List" as const,
                            content: {
                                modality:
                                    argType.tag === "ModeApp"
                                        ? argType.content.modality
                                        : "SymmetricList",
                                objects: [basicOb],
                            },
                        };
                        cell.cod = {
                            tag: "App" as const,
                            content: {
                                op: meta.codomain.apply,
                                ob: listOb,
                            },
                        };
                    } else {
                        cell.cod = basicOb;
                    }
                }

                return newFormalCell(cell);
            }
        },
    };
};

// Helper to check if two object types match (simplified comparison)
const objectTypeMatches = (type1: ObType, type2: ObType): boolean => {
    if (type1.tag !== type2.tag) return false;
    if (type1.tag === "Basic" && type2.tag === "Basic") {
        return type1.content === type2.content;
    }
    // For more complex types, we'd need deeper comparison
    // For now, just do a simple tag match
    return true;
};

type CellConstructor = ReturnType<typeof modelCellConstructor>;

const getCellConstructors = (doc: ModelDoc): CellConstructor[] => {
    const theory = theoriesCache.get(doc.theory);
    if (!theory) {
        return [];
    }
    return (theory.modelTypes ?? []).map((meta) =>
        modelCellConstructor(meta, theory, doc)
    );
};

export type AddCellArgs = {
    cellType?: string;
    name?: string;
    dom?: string;
    cod?: string;
    position?: string;
};

export async function addCells(
    handle: DocHandle<ModelDoc>,
    _repo: Repo,
    cells?: AddCellArgs[]
) {
    const queue = cells && cells.length > 0 ? cells : [{}];
    for (const cellArgs of queue) {
        await addSingleCell(handle, cellArgs);
    }
}

export default async function addCell(
    handle: DocHandle<ModelDoc>,
    repo: Repo,
    args?: AddCellArgs
) {
    await addCells(handle, repo, args ? [args] : undefined);
}

async function addSingleCell(
    handle: DocHandle<ModelDoc>,
    cellArgs: AddCellArgs = {}
) {
    const doc = handle.doc();
    if (!doc) {
        throw new Error("Document not available");
    }

    const cellConstructors = getCellConstructors(doc);
    if (cellConstructors.length === 0) {
        throw new Error("No cell constructors found");
    }

    const selectedType = cellArgs.cellType ?? cellConstructors[0].name;
    const constructor = cellConstructors.find(
        (c: CellConstructor) => c.name === selectedType
    );

    if (!constructor) {
        throw new Error(`Cell type "${selectedType}" not found`);
    }

    handle.change((doc) => {
        const notebook = doc.notebook;
        const newCell = constructor.construct();

        const findObjectIdByName = (name: string): string | null => {
            const formalContent = NotebookUtils.getFormalContent(
                notebook
            ) as ModelJudgment[];
            const objects = formalContent.filter(
                (j): j is ObjectDecl => j.tag === "object"
            );
            const obj = objects.find((o) => o.name === name || o.id === name);
            return obj?.id ?? null;
        };

        if (newCell.tag === "formal" && cellArgs?.name) {
            const content = newCell.content as ModelJudgment;
            content.name = cellArgs.name;
        }

        if (newCell.tag === "formal") {
            const content = newCell.content as ModelJudgment;
            if (content.tag === "morphism") {
                const morphism = content as MorphismDecl;
                const theory = theoriesCache.get(doc.theory);
                const morTypeMeta = theory?.modelTypes?.find(
                    (m) =>
                        m.tag === "MorType" &&
                        JSON.stringify(m.morType) ===
                            JSON.stringify(morphism.morType)
                );

                if (cellArgs?.dom) {
                    const domId = findObjectIdByName(cellArgs.dom);
                    if (domId) {
                        const basicOb = {
                            tag: "Basic" as const,
                            content: domId,
                        };
                        if (
                            morTypeMeta?.tag === "MorType" &&
                            morTypeMeta.domain?.apply &&
                            theory
                        ) {
                            const argType = theory.theory.dom(
                                morTypeMeta.domain.apply
                            );
                            const listOb = {
                                tag: "List" as const,
                                content: {
                                    modality:
                                        argType.tag === "ModeApp"
                                            ? argType.content.modality
                                            : "SymmetricList",
                                    objects: [basicOb],
                                },
                            };
                            morphism.dom = {
                                tag: "App" as const,
                                content: {
                                    op: morTypeMeta.domain.apply,
                                    ob: listOb,
                                },
                            };
                        } else {
                            morphism.dom = basicOb;
                        }
                    }
                }

                if (cellArgs?.cod) {
                    const codId = findObjectIdByName(cellArgs.cod);
                    if (codId) {
                        const basicOb = {
                            tag: "Basic" as const,
                            content: codId,
                        };
                        if (
                            morTypeMeta?.tag === "MorType" &&
                            morTypeMeta.codomain?.apply &&
                            theory
                        ) {
                            const argType = theory.theory.dom(
                                morTypeMeta.codomain.apply
                            );
                            const listOb = {
                                tag: "List" as const,
                                content: {
                                    modality:
                                        argType.tag === "ModeApp"
                                            ? argType.content.modality
                                            : "SymmetricList",
                                    objects: [basicOb],
                                },
                            };
                            morphism.cod = {
                                tag: "App" as const,
                                content: {
                                    op: morTypeMeta.codomain.apply,
                                    ob: listOb,
                                },
                            };
                        } else {
                            morphism.cod = basicOb;
                        }
                    }
                }
            }
        }

        let index: number;
        const position = cellArgs?.position || "end";

        if (position === "end") {
            index = notebook.cellOrder.length;
        } else if (position === "beginning") {
            index = 0;
        } else if (position.startsWith("after:")) {
            const afterCellLabel = position.substring(6);
            const formalContent = NotebookUtils.getFormalContent(
                notebook
            ) as ModelJudgment[];
            const afterCell = formalContent.find(
                (c) => c.name === afterCellLabel || c.id === afterCellLabel
            );

            if (afterCell) {
                const afterIndex = notebook.cellOrder.indexOf(afterCell.id);
                index =
                    afterIndex >= 0
                        ? afterIndex + 1
                        : notebook.cellOrder.length;
            } else {
                index = notebook.cellOrder.length;
            }
        } else {
            index = notebook.cellOrder.length;
        }

        NotebookUtils.insertCellAtIndex(notebook, newCell, index);
    });
}
