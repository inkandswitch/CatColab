import { DocHandle } from "@automerge/automerge-repo";
import { AIEditPrompt } from "@patchwork/sdk";
import { v7 } from "uuid";

// Type definitions based on catlog-wasm structure
interface ModelDocumentContent {
  name: string;
  theory: string;
  notebook: {
    cells: NotebookCell[];
  };
  type: string;
}

type NotebookCell =
  | { tag: "rich-text"; id: string; content: string }
  | { tag: "formal"; id: string; content: ModelJudgment }
  | { tag: "stem"; id: string };

type ModelJudgment =
  | { tag: "object"; id: string; name: string; obType: ObType }
  | {
      tag: "morphism";
      id: string;
      name: string;
      morType: MorType;
      dom: Ob | null;
      cod: Ob | null;
    };

type ObType =
  | { tag: "Basic"; content: string }
  | { tag: "Tabulator"; content: MorType };

type MorType =
  | { tag: "Basic"; content: string }
  | { tag: "Hom"; content: ObType };

type Ob =
  | { tag: "Basic"; content: string }
  | { tag: "Tabulated"; content: string };

// Edit operation types
type EditOperation =
  | { type: "add-cell"; cellType: "rich-text"; content: string }
  | { type: "add-cell"; cellType: "object"; name: string; obType: ObType }
  | {
      type: "add-cell";
      cellType: "morphism";
      name: string;
      dom: string;
      cod: string;
      morType: MorType;
    }
  | { type: "edit-cell"; id: string; updates: any }
  | { type: "delete-cell"; id: string };

/** Generate a UUID v7 (time-ordered) for new cells and objects. */
function generateUUID(): string {
  return v7();
}

/** Deep merge source object into target object */
function deepMerge(target: any, source: any) {
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

function createObjectIdMap(cells: NotebookCell[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const cell of cells) {
    if (cell.tag === "formal" && cell.content.tag === "object") {
      map.set(cell.content.name, cell.content.id);
    }
  }
  return map;
}

export const stockFlowAIPrompt: AIEditPrompt<ModelDocumentContent> = {
  id: "stock-flow-ai-prompt",
  name: "Stock Flow Diagram Editor",
  type: "patchwork:ai-prompt",
  datatypeId: "catcolab-model",
  module: {
    docToText: (doc: ModelDocumentContent) => JSON.stringify(doc, null, 2),
    textToDoc: (text: string) => JSON.parse(text),
    prompt: `You are an AI assistant helping to edit stock flow diagrams in CatColab.

# Stock Flow Diagram Concepts

**Stock Flow Diagrams** model systems with:
- **Stocks**: Accumulating quantities (populations, inventory, etc.) - represented as rectangles
- **Flows**: Rates of change between stocks (birth rates, consumption, etc.) - represented as arrows
- **Links**: Dependencies where a stock influences a flow rate - represented as curved lines

Common examples: epidemiological models (S-E-I-R-V), supply chains, economic models, population dynamics.

# CatColab Schema Structure

Documents follow this JSON structure:

\`\`\`json
{
  "name": "Model Name",
  "theory": "primitive-stock-flow",
  "type": "model",
  "notebook": {
    "cells": [
      // Rich text cells for explanations
      {
        "tag": "rich-text",
        "id": "uuid-here",
        "content": "Human readable explanation"
      },
      // Formal cells for mathematical objects
      {
        "tag": "formal",
        "id": "uuid-here",
        "content": {
          "tag": "object",  // Declares a stock
          "id": "uuid-here",
          "name": "Population",
          "obType": {"tag": "Basic", "content": "Object"}
        }
      },
      {
        "tag": "formal",
        "id": "uuid-here",
        "content": {
          "tag": "morphism",  // Declares a flow
          "id": "uuid-here",
          "name": "birth_rate",
          "dom": {"tag": "Basic", "content": "source-population-id"},
          "cod": {"tag": "Basic", "content": "target-population-id"},
          "morType": {"tag": "Hom", "content": {"tag": "Basic", "content": "Object"}}
        }
      }
    ]
  }
}
\`\`\`

**Key concepts**:
- **dom** (domain) = source stock of a flow
- **cod** (codomain) = target stock of a flow
- **Objects** represent stocks (accumulating quantities)
- **Morphisms** represent flows (rates of change) or links (dependencies)

# Example: SEIRV Epidemiological Model

This model has 5 stocks (populations) and flows between them:

**Stocks**: Susceptible → Exposed → Infectious → Recovered, plus Vaccinated
**Flows**: exposure, vaccination, infection, recovery
**Link**: Infectious population influences exposure rate

\`\`\`json
// Stock: Susceptible population
{
  "tag": "object",
  "name": "Susceptible",
  "obType": {"tag": "Basic", "content": "Object"}
}

// Flow: People move from Susceptible to Exposed
{
  "tag": "morphism",
  "name": "exposure",
  "dom": {"tag": "Basic", "content": "susceptible-id"},
  "cod": {"tag": "Basic", "content": "exposed-id"},
  "morType": {"tag": "Hom", "content": {"tag": "Basic", "content": "Object"}}
}

// Link: Infectious population affects exposure rate
{
  "tag": "morphism",
  "name": "",
  "dom": {"tag": "Basic", "content": "infectious-id"},
  "cod": {"tag": "Tabulated", "content": "exposure-flow-id"},
  "morType": {"tag": "Basic", "content": "Link"}
}
\`\`\`

# Making Edits

When the user requests changes, respond with a concise explanation followed by your edits in this format:

I'll add a Dead population and mortality flow from Infectious to Dead.

<edit>
[
  {
    "type": "add-cell",
    "cellType": "rich-text",
    "content": "New explanation text"
  },
  {
    "type": "add-cell",
    "cellType": "object",
    "name": "Dead",
    "obType": {"tag": "Basic", "content": "Object"}
  },
  {
    "type": "add-cell",
    "cellType": "morphism",
    "name": "mortality",
    "dom": "infectious-population-name",
    "cod": "dead-population-name",
    "morType": {"tag": "Hom", "content": {"tag": "Basic", "content": "Object"}}
  },
  {
    "type": "edit-cell",
    "id": "existing-cell-id",
    "updates": {
      "content": "Updated content"
    }
  },
  {
    "type": "delete-cell",
    "id": "cell-id-to-remove"
  }
]
</edit>

**Edit Guidelines**:
- For **add-cell** with morphisms, reference objects by name (I'll resolve to IDs)
- For **edit-cell**, provide partial updates that will be merged into the existing cell
- **Rich text** cells provide context and explanations
- **Object** cells create new stocks
- **Morphism** cells create flows between stocks or links from stocks to flows
- Always maintain logical flow: stocks should connect via meaningful processes
- Use domain knowledge for realistic models (epidemiology, economics, etc.)

**Edit Examples**:
- Update rich-text content: \`{"type": "edit-cell", "id": "...", "updates": {"content": "New text"}}\`
- Update object name: \`{"type": "edit-cell", "id": "...", "updates": {"content": {"name": "New Name"}}}\`
- Update morphism domain: \`{"type": "edit-cell", "id": "...", "updates": {"content": {"dom": {"tag": "Basic", "content": "new-id"}}}}\`

You MUST provide a brief explanation followed by <edit> tags with valid JSON!`,

    edit: async (
      handle: DocHandle<ModelDocumentContent>,
      operations: EditOperation[]
    ) => {
      console.log("🔧 Starting edit operation...");
      console.log("📋 Received operations:", operations);
      console.log(`📋 Applying ${operations.length} operations`);

      handle.change((doc) => {
        // Create a map of object names to IDs for resolving references
        const objectNameToId = createObjectIdMap(doc.notebook.cells);
        console.log(
          "🗺️ Object name to ID mapping:",
          Array.from(objectNameToId.entries())
        );

        for (const op of operations) {
          console.log(`🔄 Processing operation:`, op);
          switch (op.type) {
            case "add-cell":
              const newCellId = generateUUID();

              if (op.cellType === "rich-text") {
                console.log(
                  `📝 Adding rich-text cell: "${op.content.substring(
                    0,
                    50
                  )}..."`
                );
                doc.notebook.cells.push({
                  tag: "rich-text",
                  id: newCellId,
                  content: op.content,
                });
              } else if (op.cellType === "object") {
                const newObjectId = generateUUID();
                console.log(
                  `📦 Adding object: "${op.name}" with ID: ${newObjectId}`
                );
                doc.notebook.cells.push({
                  tag: "formal",
                  id: newCellId,
                  content: {
                    tag: "object",
                    id: newObjectId,
                    name: op.name,
                    obType: op.obType,
                  },
                });
                // Update the name-to-id mapping
                objectNameToId.set(op.name, newObjectId);
              } else if (op.cellType === "morphism") {
                const newMorphismId = generateUUID();

                // Resolve dom and cod references
                const domId = objectNameToId.get(op.dom) || op.dom;
                const codId = objectNameToId.get(op.cod) || op.cod;

                console.log(
                  `🔗 Adding morphism: "${op.name}" from "${op.dom}" (${domId}) to "${op.cod}" (${codId})`
                );

                doc.notebook.cells.push({
                  tag: "formal",
                  id: newCellId,
                  content: {
                    tag: "morphism",
                    id: newMorphismId,
                    name: op.name,
                    dom: { tag: "Basic", content: domId },
                    cod: { tag: "Basic", content: codId },
                    morType: op.morType,
                  },
                });
              }
              break;

            case "edit-cell":
              const cellIndex = doc.notebook.cells.findIndex(
                (c) => c.id === op.id
              );
              if (cellIndex >= 0) {
                const cell = doc.notebook.cells[cellIndex];
                console.log(
                  `✏️ Editing cell ${op.id} with updates:`,
                  op.updates
                );

                // Deep merge the updates into the cell
                deepMerge(cell, op.updates);
              } else {
                console.log(`⚠️ Cell ${op.id} not found for editing`);
              }
              break;

            case "delete-cell":
              const initialLength = doc.notebook.cells.length;
              const deleteIndex = doc.notebook.cells.findIndex(
                (c) => c.id === op.id
              );
              if (deleteIndex !== -1) {
                doc.notebook.cells.splice(deleteIndex, 1);
              }
              const deletedCount = initialLength - doc.notebook.cells.length;
              console.log(
                `🗑️ Deleted ${deletedCount} cell(s) with ID ${op.id}`
              );
              break;
          }
        }

        console.log("✅ All operations completed successfully");
      });
    },
  },
};
