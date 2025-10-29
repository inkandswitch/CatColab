import { DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { newMorphismDecl, newObjectDecl } from "../../frontend/src/model";
import { newFormalCell, NotebookUtils } from "../../frontend/src/notebook";
import { stdTheories } from "../../frontend/src/stdlib";
import { ModelDoc } from "./model_datatype";
import { ModelTypeMeta, Theory } from "../../frontend/src/theory";
import { z } from "zod";

// Preload all theories at module initialization time
const theoriesCache = new Map<string, Theory>();
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

const modelCellConstructor = (meta: ModelTypeMeta) => {
    const { name, description, shortcut } = meta;
    return {
        name,
        description,
        shortcut,
        construct() {
            return meta.tag === "ObType"
                ? newFormalCell(newObjectDecl(meta.obType))
                : newFormalCell(newMorphismDecl(meta.morType));
        },
    };
};

type CellConstructor = ReturnType<typeof modelCellConstructor>;

const getCellConstructors = (doc: ModelDoc): CellConstructor[] => {
    const theory = theoriesCache.get(doc.theory);
    if (!theory) {
        return [];
    }
    return (theory.modelTypes ?? []).map(modelCellConstructor);
};

export const argsSchema = (doc: ModelDoc) => {
    const cellConstructors = getCellConstructors(doc);

    if (cellConstructors.length === 0) {
        // Return a schema with no options if theory isn't loaded yet
        return z.object({});
    }

    const cellTypeNames = cellConstructors.map((c: CellConstructor) => c.name);
    const defaultType = cellTypeNames[0];

    return z.object({
        cellType: z
            .enum(cellTypeNames as [string, ...string[]])
            .default(defaultType)
            .describe("Type of cell to add"),
    });
};

export default async function addCell(
    handle: DocHandle<ModelDoc>,
    _repo: Repo,
    args?: { cellType: string }
) {
    // Ensure theories are loaded before proceeding
    await preloadPromise;

    const doc = handle.docSync();
    if (!doc) {
        throw new Error("Document not available");
    }

    const cellConstructors = getCellConstructors(doc);

    if (cellConstructors.length === 0) {
        throw new Error("No cell constructors found");
    }

    const selectedType = args?.cellType ?? cellConstructors[0].name;
    const constructor = cellConstructors.find(
        (c: CellConstructor) => c.name === selectedType
    );

    if (!constructor) {
        throw new Error(`Cell type "${selectedType}" not found`);
    }

    handle.change((doc) => {
        const notebook = doc.notebook;
        const newCell = constructor.construct();
        const index = notebook.cellOrder.length;
        NotebookUtils.insertCellAtIndex(notebook, newCell, index);
    });
}
