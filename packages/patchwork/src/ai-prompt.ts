import { DocHandle } from "@automerge/automerge-repo";
import { AIEditPrompt } from "@patchwork/sdk";
import { v7 } from "uuid";

console.log("this is the full updated ai prompt");

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

// Cell definition for add-cells operation
type CellDefinition =
  | { cellType: "rich-text"; content: string }
  | { cellType: "object"; name: string; obType: ObType }
  | {
      cellType: "morphism";
      name: string;
      dom: string;
      cod: string;
      morType: MorType;
    };

// Edit operation types
type EditOperation =
  | {
      type: "add-cell";
      cellType: "rich-text";
      content: string;
      position: { after?: string; before?: string };
    }
  | {
      type: "add-cell";
      cellType: "object";
      name: string;
      obType: ObType;
      position: { after?: string; before?: string };
    }
  | {
      type: "add-cell";
      cellType: "morphism";
      name: string;
      dom: string;
      cod: string;
      morType: MorType;
      position: { after?: string; before?: string };
    }
  | {
      type: "add-cells";
      cells: CellDefinition[];
      position: { after?: string; before?: string };
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

json:
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

json:
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


# Making Edits

When the user requests changes, respond with a concise explanation followed by your edits in this format:

I'll add a Dead population and mortality flow from Infectious to Dead.

<edit>
[
  {
    "type": "add-cell",
    "cellType": "rich-text",
    "content": "New explanation text",
    "position": {"index": 10}
  },
  {
    "type": "add-cell",
    "cellType": "object",
    "name": "Dead",
    "obType": {"tag": "Basic", "content": "Object"},
    "position": {"index": 11}
  },
  {
    "type": "add-cell",
    "cellType": "morphism",
    "name": "mortality",
    "dom": "infectious-population-name",
    "cod": "dead-population-name",
    "morType": {"tag": "Hom", "content": {"tag": "Basic", "content": "Object"}},
    "position": {"after": "some-cell-id"}
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

**Positioning Cells (REQUIRED)**:
- The "position" field is REQUIRED for all "add-cell" and "add-cells" operations
- You must specify one of these position options:
  - "position": {"after": "cell-id-or-name"} - Insert after the cell with this ID or name
  - "position": {"before": "cell-id-or-name"} - Insert before the cell with this ID or name
  - "position": {"after": "_start"} - Insert at the beginning of the notebook
- For existing cells, use their ID (found in the document)
- For cells you created earlier in the same edit, use their name
- Example: {"type": "add-cell", "cellType": "rich-text", "content": "Text", "position": {"after": "abc-123"}}

**Adding Multiple Consecutive Cells**:
- Use the "add-cells" operation to insert multiple cells at once at the same position
- This is much cleaner than using multiple "add-cell" operations
- The cells will be inserted consecutively in the order they appear in the "cells" array
- Example:
json:
{
  "type": "add-cells",
  "cells": [
    {"cellType": "rich-text", "content": "First cell"},
    {"cellType": "object", "name": "MyStock", "obType": {"tag": "Basic", "content": "Object"}},
    {"cellType": "rich-text", "content": "Third cell"}
  ],
  "position": {"after": "some-cell-id"}
}

- This inserts all three cells consecutively after the specified cell
- You can use the same position options: "after" or "before"

**Inserting After New Cells**:
- When inserting after a cell you created earlier in the same edit, use the cell's name
- For objects, use the object name (e.g., "MyStock")
- For morphisms, use the morphism name (e.g., "birth_rate")
- For rich-text cells, you cannot reference them by name (they don't have names)

**Edit Examples**:
- Update rich-text content: {"type": "edit-cell", "id": "...", "updates": {"content": "New text"}}
- Update object name: {"type": "edit-cell", "id": "...", "updates": {"content": {"name": "New Name"}}}
- Update morphism domain: {"type": "edit-cell", "id": "...", "updates": {"content": {"dom": {"tag": "Basic", "content": "new-id"}}}}
- Insert cell at beginning: {"type": "add-cell", "cellType": "rich-text", "content": "Text", "position": {"after": "_start"}}
- Insert after specific existing cell: {"type": "add-cell", "cellType": "object", "name": "Stock", "obType": {...}, "position": {"after": "cell-123"}}
- Insert after a new object you created: {"type": "add-cell", "cellType": "rich-text", "content": "Explanation", "position": {"after": "MyNewStock"}}
- Add multiple cells after a cell: {"type": "add-cells", "cells": [...], "position": {"after": "cell-456"}}

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

        // Separate operations by type and prepare add operations
        const addOps: Array<{
          op: EditOperation & { type: "add-cell" | "add-cells" };
          cell: NotebookCell;
          position?: { after?: string; before?: string };
        }> = [];
        const otherOps: EditOperation[] = [];
        
        // Track names of newly created cells for referencing
        const newCellNames = new Map<string, string>(); // name -> cell ID

        // First pass: prepare all cells and categorize operations
        for (const op of operations) {
          if (op.type === "add-cell") {
            const newCellId = generateUUID();
            let newCell: NotebookCell | null = null;

            if (op.cellType === "rich-text") {
              console.log(
                `📝 Preparing rich-text cell: "${op.content.substring(
                  0,
                  50
                )}..."`
              );
              newCell = {
                tag: "rich-text",
                id: newCellId,
                content: op.content,
              };
            } else if (op.cellType === "object") {
              const newObjectId = generateUUID();
              console.log(
                `📦 Preparing object: "${op.name}" with ID: ${newObjectId}`
              );
              newCell = {
                tag: "formal",
                id: newCellId,
                content: {
                  tag: "object",
                  id: newObjectId,
                  name: op.name,
                  obType: op.obType,
                },
              };
              // Update the name-to-id mapping immediately
              objectNameToId.set(op.name, newObjectId);
              // Track the cell name for later referencing
              newCellNames.set(op.name, newCellId);
            } else if (op.cellType === "morphism") {
              const newMorphismId = generateUUID();
              // Resolve dom and cod references
              const domId = objectNameToId.get(op.dom) || op.dom;
              const codId = objectNameToId.get(op.cod) || op.cod;

              console.log(
                `🔗 Preparing morphism: "${op.name}" from "${op.dom}" (${domId}) to "${op.cod}" (${codId})`
              );

              newCell = {
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
              };
              // Track the cell name for later referencing
              newCellNames.set(op.name, newCellId);
            }

            if (newCell) {
              addOps.push({ op, cell: newCell, position: op.position });
            }
          } else if (op.type === "add-cells") {
            // Handle multiple cells being added at once
            console.log(`📚 Preparing to add ${op.cells.length} cells`);

            for (const cellDef of op.cells) {
              const newCellId = generateUUID();
              let newCell: NotebookCell | null = null;

              if (cellDef.cellType === "rich-text") {
                newCell = {
                  tag: "rich-text",
                  id: newCellId,
                  content: cellDef.content,
                };
              } else if (cellDef.cellType === "object") {
                const newObjectId = generateUUID();
                newCell = {
                  tag: "formal",
                  id: newCellId,
                  content: {
                    tag: "object",
                    id: newObjectId,
                    name: cellDef.name,
                    obType: cellDef.obType,
                  },
                };
                // Update the name-to-id mapping immediately
                objectNameToId.set(cellDef.name, newObjectId);
                // Track the cell name for later referencing  
                newCellNames.set(cellDef.name, newCellId);
              } else if (cellDef.cellType === "morphism") {
                const newMorphismId = generateUUID();
                // Resolve dom and cod references
                const domId = objectNameToId.get(cellDef.dom) || cellDef.dom;
                const codId = objectNameToId.get(cellDef.cod) || cellDef.cod;

                newCell = {
                  tag: "formal",
                  id: newCellId,
                  content: {
                    tag: "morphism",
                    id: newMorphismId,
                    name: cellDef.name,
                    dom: { tag: "Basic", content: domId },
                    cod: { tag: "Basic", content: codId },
                    morType: cellDef.morType,
                  },
                };
                // Track the cell name for later referencing
                newCellNames.set(cellDef.name, newCellId);
              }

              if (newCell) {
                addOps.push({ op, cell: newCell, position: op.position });
              }
            }
          } else {
            otherOps.push(op);
          }
        }

        // Helper function to find cell index by ID or name
        const findCellIndex = (idOrName: string): number => {
          // Check for special "_start" case
          if (idOrName === "_start") {
            return -1; // Special marker for beginning
          }
          
          // First try to find by cell ID
          let index = doc.notebook.cells.findIndex(c => c.id === idOrName);
          if (index >= 0) return index;
          
          // Then try to find by newly created cell name
          const cellId = newCellNames.get(idOrName);
          if (cellId) {
            index = doc.notebook.cells.findIndex(c => c.id === cellId);
            if (index >= 0) return index;
          }
          
          // Finally try to find by object/morphism name in existing cells
          index = doc.notebook.cells.findIndex(c => {
            if (c.tag === "formal" && c.content.tag === "object") {
              return c.content.name === idOrName;
            }
            if (c.tag === "formal" && c.content.tag === "morphism") {
              return c.content.name === idOrName;
            }
            return false;
          });
          
          return index;
        };

        // Group cells by their parent operation
        const cellGroups = new Map<EditOperation, NotebookCell[]>();
        for (const { op, cell } of addOps) {
          if (!cellGroups.has(op)) {
            cellGroups.set(op, []);
          }
          cellGroups.get(op)!.push(cell);
        }

        // Process operations (no need for complex sorting since we don't use indexes)
        for (const [op, cells] of cellGroups.entries()) {
          if (op.position.after) {
            // Insert after specific cell ID/name
            const afterIndex = findCellIndex(op.position.after);
            if (op.position.after === "_start") {
              // Special case: insert at beginning
              doc.notebook.cells.splice(0, 0, ...cells);
              console.log(
                `📍 Inserted ${cells.length} cell(s) at the beginning`
              );
            } else if (afterIndex >= 0) {
              doc.notebook.cells.splice(afterIndex + 1, 0, ...cells);
              console.log(
                `📍 Inserted ${cells.length} cell(s) after: ${op.position.after}`
              );
            } else {
              console.log(
                `⚠️ Cell ${op.position.after} not found, adding at end`
              );
              doc.notebook.cells.push(...cells);
            }
          } else if (op.position.before) {
            // Insert before specific cell ID/name
            const beforeIndex = findCellIndex(op.position.before);
            if (beforeIndex >= 0) {
              doc.notebook.cells.splice(beforeIndex, 0, ...cells);
              console.log(
                `📍 Inserted ${cells.length} cell(s) before: ${op.position.before}`
              );
            } else {
              console.log(
                `⚠️ Cell ${op.position.before} not found, adding at end`
              );
              doc.notebook.cells.push(...cells);
            }
          } else {
            // Position is required, this should not happen
            console.error(`❌ Position is required for add operations`);
            throw new Error(
              "Position is required for add-cell and add-cells operations"
            );
          }
        }

        // Process other operations (edit-cell, delete-cell)
        for (const op of otherOps) {
          console.log(`🔄 Processing ${op.type} operation`);
          switch (op.type) {
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
