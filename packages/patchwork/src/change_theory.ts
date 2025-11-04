import type { DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { NotebookUtils } from "../../frontend/src/notebook";
import { stdTheories } from "../../frontend/src/stdlib";
import { ModelDoc } from "./model_datatype";
import { z } from "zod";
import type { ModelJudgment } from "catlog-wasm";
import { elaborateModel, DblModelMap } from "catlog-wasm";

// Preload all theories at module initialization time (reuse from actions.ts pattern)
const theoriesCache = new Map();
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

export const argsSchema = (doc: ModelDoc) => {
    const currentTheory = theoriesCache.get(doc.theory);

    if (!currentTheory) {
        return z.object({});
    }

    // Get migration targets
    let targetTheoryIds: string[];
    if (!NotebookUtils.hasFormalCells(doc.notebook)) {
        // If no formal cells, can migrate to any theory
        targetTheoryIds = Array.from(stdTheories.allMetadata()).map(
            (m) => m.id
        );
    } else {
        // Otherwise, only migration targets from current theory
        targetTheoryIds = currentTheory.migrationTargets;
    }

    if (targetTheoryIds.length === 0) {
        return z.object({
            message: z.literal(
                "No migration targets available for current theory"
            ),
        });
    }

    // Get theory names for the enum
    const theoryOptions = targetTheoryIds
        .map((id) => {
            const meta = stdTheories.getMetadata(id);
            return { id, name: meta.name };
        })
        .filter((t) => t.id !== doc.theory); // Exclude current theory

    if (theoryOptions.length === 0) {
        return z.object({
            message: z.literal("Already using the only available theory"),
        });
    }

    const theoryNames = theoryOptions.map((t) => t.name);

    return z.object({
        theory: z
            .enum(theoryNames as [string, ...string[]])
            .describe("Target theory to migrate to"),
    });
};

export default async function changeTheory(
    handle: DocHandle<ModelDoc>,
    _repo: Repo,
    args?: { theory?: string }
) {
    await preloadPromise;

    const doc = handle.doc();
    if (!doc) {
        throw new Error("Document not available");
    }

    if (!args?.theory) {
        throw new Error("No theory specified");
    }

    // Find theory ID by name
    let targetTheoryId: string | null = null;
    for (const meta of stdTheories.allMetadata()) {
        if (meta.name === args.theory) {
            targetTheoryId = meta.id;
            break;
        }
    }

    if (!targetTheoryId) {
        throw new Error(`Theory not found: ${args.theory}`);
    }

    // Load theories if not in cache
    const currentTheory =
        theoriesCache.get(doc.theory) || (await stdTheories.get(doc.theory));
    const targetTheory =
        theoriesCache.get(targetTheoryId) ||
        (await stdTheories.get(targetTheoryId));

    if (!currentTheory) {
        throw new Error("Current theory not found");
    }

    if (!targetTheory) {
        throw new Error(`Target theory not loaded: ${targetTheoryId}`);
    }

    // Perform migration
    handle.change((doc) => {
        // Trivial migration if no formal cells
        if (!NotebookUtils.hasFormalCells(doc.notebook)) {
            doc.theory = targetTheoryId!;
            return;
        }

        // Check if it's a trivial migration (inclusion)
        if (currentTheory.inclusions.includes(targetTheoryId!)) {
            doc.theory = targetTheoryId!;
            return;
        }

        // Pushforward migration
        const migration = currentTheory.pushforwards.find(
            (m: { target: string; migrate: any }) => m.target === targetTheoryId
        );
        if (!migration) {
            throw new Error(
                `No migration defined from ${currentTheory.id} to ${targetTheoryId}`
            );
        }

        // Elaborate current model
        const instantiated = new DblModelMap();
        let model;
        try {
            model = elaborateModel(
                doc.notebook as any,
                instantiated,
                currentTheory.theory
            );
        } catch (e) {
            throw new Error(`Failed to elaborate current model: ${e}`);
        }

        // Migrate the model
        const migratedModel = migration.migrate(model, targetTheory.theory);

        // Update theory
        doc.theory = targetTheoryId!;

        // Update cell types
        const formalContent = NotebookUtils.getFormalContent(
            doc.notebook
        ) as ModelJudgment[];
        for (const judgment of formalContent) {
            if (judgment.tag === "object") {
                judgment.obType = migratedModel.obType({
                    tag: "Basic",
                    content: judgment.id,
                });
            } else if (judgment.tag === "morphism") {
                judgment.morType = migratedModel.morType({
                    tag: "Basic",
                    content: judgment.id,
                });
            }
        }
    });
}
