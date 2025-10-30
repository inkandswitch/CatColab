import { DocHandle, Repo } from "@automerge/automerge-repo/slim";
import {
    newMorphismDecl,
    newObjectDecl,
    type MorphismDecl,
    type ObjectDecl,
} from "../../frontend/src/model";
import { newFormalCell, NotebookUtils } from "../../frontend/src/notebook";
import { stdTheories } from "../../frontend/src/stdlib";
import { ModelDoc } from "./model_datatype";
import { ModelTypeMeta, Theory } from "../../frontend/src/theory";
import { z } from "zod";
import type { ModelJudgment, ObType } from "catlog-wasm";

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
                    cell.dom = { tag: "Basic", content: domMatch.id };
                }

                // Find first object matching codomain type
                const codMatch = availableObjects.find((obj) =>
                    objectTypeMatches(obj.obType, codType)
                );
                if (codMatch) {
                    cell.cod = { tag: "Basic", content: codMatch.id };
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

export const argsSchema = (doc: ModelDoc) => {
    const cellConstructors = getCellConstructors(doc);
    const theory = theoriesCache.get(doc.theory);

    if (cellConstructors.length === 0 || !theory) {
        // Return a schema with no options if theory isn't loaded yet
        return z.object({});
    }

    // Get all available objects with their labels
    const formalContent = NotebookUtils.getFormalContent(
        doc.notebook
    ) as ModelJudgment[];
    const availableObjects = formalContent.filter(
        (j): j is ObjectDecl => j.tag === "object"
    );

    // Build option schemas for each cell type
    const optionSchemas: z.ZodTypeAny[] = [];

    for (const meta of theory.modelTypes ?? []) {
        if (meta.tag === "ObType") {
            // Object types: just cellType and name
            optionSchemas.push(
                z.object({
                    cellType: z.literal(meta.name),
                    name: z
                        .string()
                        .optional()
                        .describe("Name/label for the cell"),
                })
            );
        } else if (meta.tag === "MorType") {
            // Morphism types: cellType, name, dom, and cod
            const domType = theory.theory.src(meta.morType);
            const codType = theory.theory.tgt(meta.morType);

            console.log(`[argsSchema] Building schema for ${meta.name}`);
            console.log(`  domType:`, domType);
            console.log(`  codType:`, codType);
            console.log(
                `  availableObjects:`,
                availableObjects.map((o) => ({
                    name: o.name,
                    obType: o.obType,
                }))
            );

            // Find objects matching domain type
            const domObjects = availableObjects.filter((obj) =>
                objectTypeMatches(obj.obType, domType)
            );
            const domLabels = domObjects
                .map((obj) => obj.name || obj.id)
                .filter((label, index, arr) => arr.indexOf(label) === index); // dedupe

            console.log(
                `  domObjects:`,
                domObjects.map((o) => o.name)
            );
            console.log(`  domLabels:`, domLabels);

            // Find objects matching codomain type
            const codObjects = availableObjects.filter((obj) =>
                objectTypeMatches(obj.obType, codType)
            );
            const codLabels = codObjects
                .map((obj) => obj.name || obj.id)
                .filter((label, index, arr) => arr.indexOf(label) === index); // dedupe

            console.log(
                `  codObjects:`,
                codObjects.map((o) => o.name)
            );
            console.log(`  codLabels:`, codLabels);

            const morphismSchema: Record<string, z.ZodTypeAny> = {
                cellType: z.literal(meta.name),
                name: z.string().optional().describe("Name/label for the cell"),
            };

            // Always include dom/cod fields for morphisms, even if no objects available yet
            if (domLabels.length > 0) {
                morphismSchema.dom = z
                    .enum(domLabels as [string, ...string[]])
                    .optional()
                    .describe("Domain object (source)");
            } else {
                // Use string input if no objects available yet
                morphismSchema.dom = z
                    .string()
                    .optional()
                    .describe(
                        "Domain object (source) - no matching objects available"
                    );
            }

            if (codLabels.length > 0) {
                morphismSchema.cod = z
                    .enum(codLabels as [string, ...string[]])
                    .optional()
                    .describe("Codomain object (target)");
            } else {
                // Use string input if no objects available yet
                morphismSchema.cod = z
                    .string()
                    .optional()
                    .describe(
                        "Codomain object (target) - no matching objects available"
                    );
            }

            optionSchemas.push(z.object(morphismSchema));
        }
    }

    if (optionSchemas.length === 0) {
        return z.object({});
    }

    // Create a discriminated union based on cellType
    if (optionSchemas.length === 1) {
        return optionSchemas[0];
    }

    return z.discriminatedUnion(
        "cellType",
        optionSchemas as [
            z.ZodObject<any>,
            z.ZodObject<any>,
            ...z.ZodObject<any>[]
        ]
    );
};

export default async function addCell(
    handle: DocHandle<ModelDoc>,
    _repo: Repo,
    args?: { cellType?: string; name?: string; dom?: string; cod?: string }
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

        // Helper to find object ID by name
        const findObjectIdByName = (name: string): string | null => {
            const formalContent = NotebookUtils.getFormalContent(
                notebook
            ) as ModelJudgment[];
            console.log("Finding object by name:", name);
            console.log(
                "Available objects:",
                formalContent
                    .filter((j) => j.tag === "object")
                    .map((o) => ({ id: (o as any).id, name: (o as any).name }))
            );
            const obj = formalContent.find(
                (j): j is ObjectDecl =>
                    j.tag === "object" && (j.name === name || j.id === name)
            );
            console.log("Found object:", obj);
            return obj?.id ?? null;
        };

        // Set custom name if provided
        if (newCell.tag === "formal" && args?.name) {
            const content = newCell.content as ModelJudgment;
            content.name = args.name;
        }

        // Override domain/codomain if provided in args
        if (newCell.tag === "formal") {
            const content = newCell.content as ModelJudgment;
            if (content.tag === "morphism") {
                const morphism = content as MorphismDecl;

                console.log("Setting dom/cod from args:", args);
                console.log(
                    "Before - dom:",
                    morphism.dom,
                    "cod:",
                    morphism.cod
                );

                // Resolve name to ID for domain
                if (args?.dom) {
                    const domId = findObjectIdByName(args.dom);
                    console.log("Resolved dom ID:", domId);
                    if (domId) {
                        morphism.dom = { tag: "Basic", content: domId };
                    } else {
                        console.warn(
                            "Could not find object for dom:",
                            args.dom
                        );
                    }
                }

                // Resolve name to ID for codomain
                if (args?.cod) {
                    const codId = findObjectIdByName(args.cod);
                    console.log("Resolved cod ID:", codId);
                    if (codId) {
                        morphism.cod = { tag: "Basic", content: codId };
                    } else {
                        console.warn(
                            "Could not find object for cod:",
                            args.cod
                        );
                    }
                }

                console.log("After - dom:", morphism.dom, "cod:", morphism.cod);
            }
        }

        const index = notebook.cellOrder.length;
        NotebookUtils.insertCellAtIndex(notebook, newCell, index);
    });
}
