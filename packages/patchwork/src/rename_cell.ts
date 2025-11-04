import type { DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { NotebookUtils } from "../../frontend/src/notebook";
import { ModelDoc } from "./model_datatype";
import { z } from "zod";
import type { ModelJudgment } from "catlog-wasm";
import type { ObjectDecl, MorphismDecl } from "../../frontend/src/model";

export const argsSchema = (doc: ModelDoc) => {
    const formalContent = NotebookUtils.getFormalContent(
        doc.notebook
    ) as ModelJudgment[];

    if (formalContent.length === 0) {
        return z.object({
            message: z.literal("No cells available to rename"),
        });
    }

    // Get cell labels for selection
    const cellLabels = formalContent.map((cell) => {
        const label = cell.name || cell.id;
        return label;
    });

    return z.object({
        cell: z
            .enum(cellLabels as [string, ...string[]])
            .describe("Cell to rename"),
        newName: z.string().min(1).describe("New name for the cell"),
    });
};

export default async function renameCell(
    handle: DocHandle<ModelDoc>,
    _repo: Repo,
    args?: { cell?: string; newName?: string }
) {
    const doc = handle.docSync();
    if (!doc) {
        throw new Error("Document not available");
    }

    if (!args?.cell || !args?.newName) {
        throw new Error("Cell and new name must be specified");
    }

    handle.change((doc) => {
        const formalContent = NotebookUtils.getFormalContent(
            doc.notebook
        ) as ModelJudgment[];

        // Find the cell by name or ID
        const cell = formalContent.find(
            (c) => c.name === args.cell || c.id === args.cell
        );

        if (!cell) {
            throw new Error(`Cell not found: ${args.cell}`);
        }

        if (!args.newName) {
            throw new Error("New name must be specified");
        }

        // Update the name
        cell.name = args.newName;
    });
}
