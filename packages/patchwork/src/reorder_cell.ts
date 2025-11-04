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
            message: z.literal("No cells available to reorder"),
        });
    }

    // Get cell labels for selection
    const cellLabels = formalContent.map((cell) => {
        const label = cell.name || cell.id;
        return label;
    });

    // Build position options: top, bottom, and "after:CellName" for each cell
    const positions = ["top", "bottom"];
    for (const cell of formalContent) {
        const label = cell.name || cell.id;
        positions.push(`after:${label}`);
    }

    return z.object({
        cell: z
            .enum(cellLabels as [string, ...string[]])
            .describe("Cell to move"),
        position: z
            .enum(positions as [string, ...string[]])
            .describe("Where to move the cell"),
    });
};

export default async function reorderCell(
    handle: DocHandle<ModelDoc>,
    _repo: Repo,
    args?: { cell?: string; position?: string }
) {
    const doc = handle.docSync();
    if (!doc) {
        throw new Error("Document not available");
    }

    if (!args?.cell || !args?.position) {
        throw new Error("Cell and position must be specified");
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

        const cellId = cell.id;
        const currentIndex = notebook.cellOrder.indexOf(cellId);

        if (currentIndex === -1) {
            throw new Error(`Cell ID not found in cell order: ${cellId}`);
        }

        let newIndex: number;
        const position = args.position;

        if (position === "top") {
            newIndex = 0;
        } else if (position === "bottom") {
            newIndex = notebook.cellOrder.length - 1;
        } else if (position.startsWith("after:")) {
            // Extract the cell name/id after "after:"
            const afterCellLabel = position.substring(6);
            const afterCell = formalContent.find(
                (c) => c.name === afterCellLabel || c.id === afterCellLabel
            );

            if (afterCell) {
                const afterIndex = notebook.cellOrder.indexOf(afterCell.id);
                if (afterIndex >= 0) {
                    // If moving after a cell that comes before current position,
                    // the index will shift after removal
                    newIndex =
                        afterIndex < currentIndex ? afterIndex + 1 : afterIndex;
                } else {
                    // If cell not found in order, default to bottom
                    newIndex = notebook.cellOrder.length - 1;
                }
            } else {
                // If cell not found, default to bottom
                newIndex = notebook.cellOrder.length - 1;
            }
        } else {
            throw new Error(`Invalid position: ${position}`);
        }

        // Only move if the position actually changes
        if (newIndex !== currentIndex) {
            // Remove from current position
            notebook.cellOrder.splice(currentIndex, 1);
            // Insert at new position (adjust if needed after removal)
            const insertIndex = newIndex > currentIndex ? newIndex : newIndex;
            notebook.cellOrder.splice(insertIndex, 0, cellId);
        }
    });
}
