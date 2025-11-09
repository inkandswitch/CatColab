import type { DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { NotebookUtils } from "../../frontend/src/notebook";
import { ModelDoc } from "./model_datatype";
import { z } from "zod";
import type { ModelJudgment } from "catlog-wasm";

export const argsSchema = (doc: ModelDoc) => {
    const formalContent = NotebookUtils.getFormalContent(
        doc.notebook
    ) as ModelJudgment[];

    if (formalContent.length === 0) {
        return z.object({
            message: z.literal("No cells available to delete"),
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
            .describe("Cell to delete"),
    });
};

export default async function deleteCell(
    handle: DocHandle<ModelDoc>,
    _repo: Repo,
    args?: { cell?: string }
) {
    const doc = handle.docSync();
    if (!doc) {
        throw new Error("Document not available");
    }

    if (!args?.cell) {
        throw new Error("Cell must be specified");
    }

    handle.change((doc) => {
        const notebook = doc.notebook;
        const formalContent = NotebookUtils.getFormalContent(
            notebook
        ) as ModelJudgment[];

        // Find the cell by name or ID
        const cell = formalContent.find(
            (c) => c.name === args.cell || c.id === args.cell
        );

        if (!cell) {
            throw new Error(`Cell not found: ${args.cell}`);
        }

        // Find the cell ID in the notebook
        const cellId = cell.id;
        const cellIndex = notebook.cellOrder.indexOf(cellId);

        if (cellIndex === -1) {
            throw new Error(`Cell ID not found in cell order: ${cellId}`);
        }

        // Remove from cell order
        notebook.cellOrder.splice(cellIndex, 1);

        // Remove from cell contents
        delete notebook.cellContents[cellId];
    });
}




