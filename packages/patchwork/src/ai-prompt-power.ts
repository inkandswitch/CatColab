import { DocHandle } from "@automerge/automerge-repo";
import { AIEditPrompt } from "@patchwork/sdk";
import { v7 } from "uuid";

// Type definitions based on catlog-wasm structure
interface ModelDocumentContent {
    name: string;
    theory: string;
    notebook: {
        cellContents: Record<string, NotebookCell>;
        cellOrder: string[];
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
    const uuid = v7();
    console.log(`🆔 Generated new UUID: ${uuid}`);
    return uuid;
}

/** Validate that a string is a valid UUID */
function isValidUUID(uuid: string): boolean {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/** Log and validate an ID before using it */
function validateAndLogId(id: string, context: string): string {
    console.log(`🔍 ${context} - ID: "${id}"`);
    if (!isValidUUID(id)) {
        console.error(`❌ INVALID UUID detected in ${context}: "${id}"`);
        console.error(`❌ This may cause downstream errors!`);
    } else {
        console.log(`✅ Valid UUID in ${context}: "${id}"`);
    }
    return id;
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

function createNameToIdMap(
    cellContents: Record<string, NotebookCell>
): Map<string, string> {
    const map = new Map<string, string>();
    for (const cell of Object.values(cellContents)) {
        if (cell.tag === "formal") {
            if (cell.content.tag === "object") {
                map.set(cell.content.name, cell.content.id);
            } else if (cell.content.tag === "morphism") {
                map.set(cell.content.name, cell.content.id);
            }
        }
    }
    return map;
}

export const powerSystemAIPrompt: AIEditPrompt<ModelDocumentContent> = {
    id: "power-system-ai-prompt",
    name: "Power System Diagram Editor",
    type: "patchwork:ai-prompt",
    datatypeId: "catcolab-model",
    module: {
        docToText: (doc: ModelDocumentContent) => JSON.stringify(doc, null, 2),
        textToDoc: (text: string) => JSON.parse(text),
        prompt: `You are an AI assistant helping to edit power system diagrams in CatColab.

# Power System Concepts

**Power Systems** model electrical grids with:
- **Buses**: Network nodes where power is generated, consumed, or transferred - represented as points/circles
- **Generators**: Power sources (coal, nuclear, gas, wind, solar, hydro) connected to buses - represented as circles with 'G'
- **Loads**: Power consumers (cities, industrial facilities) connected to buses - represented as arrows pointing down
- **Transmission Lines**: Connections between buses carrying electrical power - represented as lines between buses
- **Transformers**: Voltage-changing connections between buses at different voltage levels - represented as special connection symbols

Common examples: National grids (UK, US), regional transmission networks, renewable energy integration, smart grids.

# CatColab Schema Structure

Documents follow this JSON structure:

json:
{
  "name": "Model Name",
  "theory": "power-system-theory",
  "type": "model",
  "notebook": {
    "cellContents": {
      "cell-uuid-1": {
        "tag": "rich-text",
        "id": "cell-uuid-1",
        "content": "Human readable explanation"
      },
      "cell-uuid-2": {
        "tag": "formal",
        "id": "cell-uuid-2",
        "content": {
          "tag": "object",  // Declares a bus
          "id": "uuid-here",
          "name": "London_400kV",
          "obType": {"tag": "Basic", "content": "Bus"}
        }
      },
      "cell-uuid-3": {
        "tag": "formal",
        "id": "cell-uuid-3",
        "content": {
          "tag": "morphism",  // Declares a transmission line
          "id": "uuid-here",
          "name": "London_Birmingham_Line",
          "dom": {"tag": "Basic", "content": "london-bus-id"},
          "cod": {"tag": "Basic", "content": "birmingham-bus-id"},
          "morType": {"tag": "Hom", "content": {"tag": "Basic", "content": "Bus"}}
        }
      },
      "cell-uuid-4": {
        "tag": "formal",
        "id": "cell-uuid-4",
        "content": {
          "tag": "morphism",  // Declares a generator
          "id": "uuid-here",
          "name": "Hinkley_Nuclear",
          "dom": null,
          "cod": {"tag": "Basic", "content": "somerset-bus-id"},
          "morType": {"tag": "Basic", "content": "Generator"}
        }
      },
      "cell-uuid-5": {
        "tag": "formal",
        "id": "cell-uuid-5",
        "content": {
          "tag": "morphism",  // Declares a load
          "id": "uuid-here",
          "name": "London_Load",
          "dom": {"tag": "Basic", "content": "london-bus-id"},
          "cod": null,
          "morType": {"tag": "Basic", "content": "Load"}
        }
      }
    },
    "cellOrder": ["cell-uuid-1", "cell-uuid-2", "cell-uuid-3", "cell-uuid-4", "cell-uuid-5"]
  }
}


**Key concepts**:
- **Buses** are objects representing network nodes
- **Transmission Lines** are morphisms with both dom (source bus) and cod (target bus)
- **Generators** are morphisms with cod (bus they connect to) and null dom
- **Loads** are morphisms with dom (bus they connect to) and null cod
- **dom** (domain) = source/input bus
- **cod** (codomain) = target/output bus

# Example: Simplified UK Power Grid

This model has buses at major cities and generation sites, with transmission lines connecting them:

**Buses**: London, Birmingham, Manchester, Scotland, Somerset (for Hinkley Point)
**Generators**: Hinkley Point Nuclear, North Sea Wind, Scottish Hydro
**Loads**: London demand, Birmingham demand, Manchester demand
**Transmission Lines**: Connecting major cities and generation to load centers

json:
// Bus: London 400kV substation
{
  "tag": "object",
  "name": "London_400kV",
  "obType": {"tag": "Basic", "content": "Bus"}
}

// Generator: Hinkley Point Nuclear Plant (3.2 GW)
{
  "tag": "morphism",
  "name": "Hinkley_Nuclear",
  "dom": null,
  "cod": {"tag": "Basic", "content": "somerset-bus-id"},
  "morType": {"tag": "Basic", "content": "Generator"}
}

// Load: London electricity demand
{
  "tag": "morphism",
  "name": "London_Load",
  "dom": {"tag": "Basic", "content": "london-bus-id"},
  "cod": null,
  "morType": {"tag": "Basic", "content": "Load"}
}

// Transmission Line: Somerset to London (carrying nuclear power)
{
  "tag": "morphism",
  "name": "Somerset_London_Line",
  "dom": {"tag": "Basic", "content": "somerset-bus-id"},
  "cod": {"tag": "Basic", "content": "london-bus-id"},
  "morType": {"tag": "Hom", "content": {"tag": "Basic", "content": "Bus"}}
}


# Making Edits

When the user requests changes, respond with a concise explanation followed by your edits in this format:

I'll add a Manchester bus, wind generator, and transmission line to London.

<edit>
[
  {
    "type": "add-cell",
    "cellType": "rich-text",
    "content": "Northern England region",
    "position": {"after": "_start"}
  },
  {
    "type": "add-cell",
    "cellType": "object",
    "name": "Manchester_275kV",
    "obType": {"tag": "Basic", "content": "Bus"},
    "position": {"after": "some-cell-id"}
  },
  {
    "type": "add-cell",
    "cellType": "morphism",
    "name": "North_Sea_Wind",
    "dom": null,
    "cod": "Manchester_275kV",
    "morType": {"tag": "Basic", "content": "Generator"},
    "position": {"after": "Manchester_275kV"}
  },
  {
    "type": "add-cell",
    "cellType": "morphism",
    "name": "Manchester_London_Line",
    "dom": "Manchester_275kV",
    "cod": "London_400kV",
    "morType": {"tag": "Hom", "content": {"tag": "Basic", "content": "Bus"}},
    "position": {"after": "North_Sea_Wind"}
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
- **IMPORTANT**: All object and morphism names must be unique across the entire document
- For **add-cell** with morphisms, reference buses by name (I'll resolve to IDs)
- For **edit-cell**, provide partial updates that will be merged into the existing cell
- **Rich text** cells provide context and explanations
- **Object** cells create buses (network nodes)
- **Morphism** cells create:
  - **Generators**: dom=null, cod=bus-name, morType={"tag": "Basic", "content": "Generator"}
  - **Loads**: dom=bus-name, cod=null, morType={"tag": "Basic", "content": "Load"}
  - **Transmission Lines**: dom=bus-name, cod=bus-name, morType={"tag": "Hom", "content": {"tag": "Basic", "content": "Bus"}}
- Always maintain logical topology: generators connect to buses, buses connect via lines, loads consume from buses
- Use realistic power system elements (nuclear, wind, solar, coal, gas for generation; cities for loads)

**Component Types**:
- **Bus**: Network node, typically named with location and voltage (e.g., "London_400kV", "Birmingham_275kV")
- **Generator**: Power source with types like Nuclear, Wind, Solar, Coal, Gas, Hydro (e.g., "Hinkley_Nuclear_3200MW")
  - morType: {"tag": "Basic", "content": "Generator"}
- **Load**: Power consumer, typically cities or industrial sites (e.g., "London_Load_8000MW")
  - morType: {"tag": "Basic", "content": "Load"}
- **TransmissionLine**: Connection between buses (e.g., "London_Birmingham_400kV_Line")
  - morType: {"tag": "Hom", "content": {"tag": "Basic", "content": "Bus"}}

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
    {"cellType": "rich-text", "content": "Scotland region"},
    {"cellType": "object", "name": "Scotland_400kV", "obType": {"tag": "Basic", "content": "Bus"}},
    {"cellType": "morphism", "name": "Scottish_Hydro", "dom": null, "cod": "Scotland_400kV", "morType": {"tag": "Basic", "content": "Generator"}},
    {"cellType": "rich-text", "content": "Hydro provides 1.5 GW capacity"}
  ],
  "position": {"after": "some-cell-id"}
}

- This inserts all four cells consecutively after the specified cell

**Referencing Buses and Components**:
- Use names to reference buses and other components in dom/cod fields
- When inserting after a cell you created earlier in the same edit, use the cell's name
- For buses, use the bus name (e.g., "London_400kV")
- For morphisms, you generally reference buses in dom/cod, not other morphisms
- For rich-text cells, you cannot reference them by name (they don't have names)
- **Remember**: All names must be unique across the entire document!

**Edit Examples**:
- Update rich-text content: {"type": "edit-cell", "id": "...", "updates": {"content": "New text"}}
- Update bus name: {"type": "edit-cell", "id": "...", "updates": {"content": {"name": "New_Name"}}}
- Update transmission line: {"type": "edit-cell", "id": "...", "updates": {"content": {"dom": {"tag": "Basic", "content": "new-bus-id"}}}}
- Insert cell at beginning: {"type": "add-cell", "cellType": "rich-text", "content": "Text", "position": {"after": "_start"}}
- Add a bus: {"type": "add-cell", "cellType": "object", "name": "Edinburgh_275kV", "obType": {"tag": "Basic", "content": "Bus"}, "position": {"after": "cell-123"}}
- Add a generator: {"type": "add-cell", "cellType": "morphism", "name": "Solar_Farm_500MW", "dom": null, "cod": "Edinburgh_275kV", "morType": {"tag": "Basic", "content": "Generator"}, "position": {"after": "Edinburgh_275kV"}}
- Add a load: {"type": "add-cell", "cellType": "morphism", "name": "Edinburgh_Load", "dom": "Edinburgh_275kV", "cod": null, "morType": {"tag": "Basic", "content": "Load"}, "position": {"after": "Solar_Farm_500MW"}}
- Add a transmission line: {"type": "add-cell", "cellType": "morphism", "name": "Edinburgh_London_Line", "dom": "Edinburgh_275kV", "cod": "London_400kV", "morType": {"tag": "Hom", "content": {"tag": "Basic", "content": "Bus"}}, "position": {"after": "Edinburgh_Load"}}
- Add multiple components: {"type": "add-cells", "cells": [...], "position": {"after": "cell-456"}}

You MUST provide a brief explanation followed by <edit> tags with valid JSON!`,

        edit: async (
            handle: DocHandle<ModelDocumentContent>,
            operations: EditOperation[]
        ) => {
            console.log("🔧 Starting power system edit operation...");
            console.log("📋 Received operations:", operations);
            console.log(`📋 Applying ${operations.length} operations`);

            handle.change((doc) => {
                // Create unified name-to-ID map for all objects and morphisms
                const nameToId = createNameToIdMap(doc.notebook.cellContents);
                console.log(
                    "🗺️ Initial name to ID mapping:",
                    Array.from(nameToId.entries())
                );

                // Validate all existing IDs
                for (const [name, id] of nameToId.entries()) {
                    validateAndLogId(id, `existing "${name}" ID`);
                }

                // Separate operations by type and prepare add operations
                const addOps: Array<{
                    op: EditOperation & { type: "add-cell" | "add-cells" };
                    cell: NotebookCell;
                    position?: { after?: string; before?: string };
                }> = [];
                const otherOps: EditOperation[] = [];

                // Track names of newly created cells for referencing
                const newCellNames = new Map<string, string>(); // name -> cell ID

                // Helper function to resolve names to IDs (objects or morphisms)
                const resolveNameToId = (
                    name: string,
                    context: string
                ): string => {
                    // First try existing items (objects or morphisms)
                    let id = nameToId.get(name);
                    if (id) {
                        console.log(
                            `🔍 ${context} resolved "${name}" to existing ID: ${id}`
                        );
                        return id;
                    }

                    // Throw error instead of using invalid name as UUID
                    console.error(
                        `❌ ${context} could not resolve "${name}" - no object or morphism with this name exists`
                    );
                    throw new Error(
                        `Could not resolve name "${name}" in ${context}. Make sure the bus or component is defined before referencing it.`
                    );
                };

                // First pass: prepare all cells and categorize operations
                for (const op of operations) {
                    if (op.type === "add-cell") {
                        const newCellId = generateUUID();
                        validateAndLogId(newCellId, "add-cell new cell ID");
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
                                id: validateAndLogId(
                                    newCellId,
                                    "rich-text cell assignment"
                                ),
                                content: op.content,
                            };
                        } else if (op.cellType === "object") {
                            const newObjectId = generateUUID();
                            validateAndLogId(newObjectId, "add-cell object ID");
                            console.log(
                                `🔌 Preparing bus: "${op.name}" with ID: ${newObjectId}`
                            );
                            newCell = {
                                tag: "formal",
                                id: validateAndLogId(
                                    newCellId,
                                    "object cell assignment"
                                ),
                                content: {
                                    tag: "object",
                                    id: validateAndLogId(
                                        newObjectId,
                                        "object content ID"
                                    ),
                                    name: op.name,
                                    obType: op.obType,
                                },
                            };
                            // Update the name-to-id mapping immediately
                            console.log(
                                `🗺️ Mapping bus name "${op.name}" -> bus ID "${newObjectId}"`
                            );
                            nameToId.set(op.name, newObjectId);
                            // Track the cell name for later referencing
                            console.log(
                                `🏷️ Tracking cell name "${op.name}" -> cell ID "${newCellId}"`
                            );
                            newCellNames.set(op.name, newCellId);
                        } else if (op.cellType === "morphism") {
                            const newMorphismId = generateUUID();
                            validateAndLogId(
                                newMorphismId,
                                "add-cell morphism ID"
                            );

                            // Resolve dom and cod references (may be null for generators/loads)
                            let domId: string | null = null;
                            let codId: string | null = null;

                            if (op.dom) {
                                domId = resolveNameToId(
                                    op.dom,
                                    "add-cell morphism domain"
                                );
                                validateAndLogId(domId, "morphism domain ID");
                            }

                            if (op.cod) {
                                codId = resolveNameToId(
                                    op.cod,
                                    "add-cell morphism codomain"
                                );
                                validateAndLogId(codId, "morphism codomain ID");
                            }

                            console.log(
                                `⚡ Preparing power component: "${
                                    op.name
                                }" from ${op.dom || "null"} to ${
                                    op.cod || "null"
                                }`
                            );

                            newCell = {
                                tag: "formal",
                                id: validateAndLogId(
                                    newCellId,
                                    "morphism cell assignment"
                                ),
                                content: {
                                    tag: "morphism",
                                    id: validateAndLogId(
                                        newMorphismId,
                                        "morphism content ID"
                                    ),
                                    name: op.name,
                                    dom: domId
                                        ? {
                                              tag: "Basic",
                                              content: validateAndLogId(
                                                  domId,
                                                  "morphism dom content"
                                              ),
                                          }
                                        : null,
                                    cod: codId
                                        ? {
                                              tag: "Basic",
                                              content: validateAndLogId(
                                                  codId,
                                                  "morphism cod content"
                                              ),
                                          }
                                        : null,
                                    morType: op.morType,
                                },
                            };
                            // Track the cell name for later referencing
                            console.log(
                                `🏷️ Tracking morphism name "${op.name}" -> cell ID "${newCellId}"`
                            );
                            newCellNames.set(op.name, newCellId);
                            // Also add morphism name to unified map for immediate referencing
                            console.log(
                                `🗺️ Mapping morphism name "${op.name}" -> morphism ID "${newMorphismId}"`
                            );
                            nameToId.set(op.name, newMorphismId);
                        }

                        if (newCell) {
                            addOps.push({
                                op,
                                cell: newCell,
                                position: op.position,
                            });
                        }
                    } else if (op.type === "add-cells") {
                        // Handle multiple cells being added at once
                        console.log(
                            `📚 Preparing to add ${op.cells.length} cells`
                        );

                        for (const cellDef of op.cells) {
                            const newCellId = generateUUID();
                            validateAndLogId(
                                newCellId,
                                "add-cells new cell ID"
                            );
                            let newCell: NotebookCell | null = null;

                            if (cellDef.cellType === "rich-text") {
                                console.log(
                                    `📝 Preparing add-cells rich-text: "${cellDef.content.substring(
                                        0,
                                        50
                                    )}..."`
                                );
                                newCell = {
                                    tag: "rich-text",
                                    id: validateAndLogId(
                                        newCellId,
                                        "add-cells rich-text assignment"
                                    ),
                                    content: cellDef.content,
                                };
                            } else if (cellDef.cellType === "object") {
                                const newObjectId = generateUUID();
                                validateAndLogId(
                                    newObjectId,
                                    "add-cells object ID"
                                );
                                console.log(
                                    `🔌 Preparing add-cells bus: "${cellDef.name}" with ID: ${newObjectId}`
                                );
                                newCell = {
                                    tag: "formal",
                                    id: validateAndLogId(
                                        newCellId,
                                        "add-cells object cell assignment"
                                    ),
                                    content: {
                                        tag: "object",
                                        id: validateAndLogId(
                                            newObjectId,
                                            "add-cells object content ID"
                                        ),
                                        name: cellDef.name,
                                        obType: cellDef.obType,
                                    },
                                };
                                // Update the name-to-id mapping immediately
                                console.log(
                                    `🗺️ Mapping add-cells bus name "${cellDef.name}" -> bus ID "${newObjectId}"`
                                );
                                nameToId.set(cellDef.name, newObjectId);
                                // Track the cell name for later referencing
                                console.log(
                                    `🏷️ Tracking add-cells cell name "${cellDef.name}" -> cell ID "${newCellId}"`
                                );
                                newCellNames.set(cellDef.name, newCellId);
                            } else if (cellDef.cellType === "morphism") {
                                const newMorphismId = generateUUID();
                                validateAndLogId(
                                    newMorphismId,
                                    "add-cells morphism ID"
                                );

                                // Resolve dom and cod references (may be null for generators/loads)
                                let domId: string | null = null;
                                let codId: string | null = null;

                                if (cellDef.dom) {
                                    domId = resolveNameToId(
                                        cellDef.dom,
                                        "add-cells morphism domain"
                                    );
                                    validateAndLogId(
                                        domId,
                                        "add-cells morphism domain ID"
                                    );
                                }

                                if (cellDef.cod) {
                                    codId = resolveNameToId(
                                        cellDef.cod,
                                        "add-cells morphism codomain"
                                    );
                                    validateAndLogId(
                                        codId,
                                        "add-cells morphism codomain ID"
                                    );
                                }

                                console.log(
                                    `⚡ Preparing add-cells power component: "${cellDef.name}"`
                                );

                                newCell = {
                                    tag: "formal",
                                    id: validateAndLogId(
                                        newCellId,
                                        "add-cells morphism cell assignment"
                                    ),
                                    content: {
                                        tag: "morphism",
                                        id: validateAndLogId(
                                            newMorphismId,
                                            "add-cells morphism content ID"
                                        ),
                                        name: cellDef.name,
                                        dom: domId
                                            ? {
                                                  tag: "Basic",
                                                  content: validateAndLogId(
                                                      domId,
                                                      "add-cells morphism dom content"
                                                  ),
                                              }
                                            : null,
                                        cod: codId
                                            ? {
                                                  tag: "Basic",
                                                  content: validateAndLogId(
                                                      codId,
                                                      "add-cells morphism cod content"
                                                  ),
                                              }
                                            : null,
                                        morType: cellDef.morType,
                                    },
                                };
                                // Track the cell name for later referencing
                                console.log(
                                    `🏷️ Tracking add-cells morphism name "${cellDef.name}" -> cell ID "${newCellId}"`
                                );
                                newCellNames.set(cellDef.name, newCellId);
                                // Also add morphism name to unified map for immediate referencing
                                console.log(
                                    `🗺️ Mapping add-cells morphism name "${cellDef.name}" -> morphism ID "${newMorphismId}"`
                                );
                                nameToId.set(cellDef.name, newMorphismId);
                            }

                            if (newCell) {
                                addOps.push({
                                    op,
                                    cell: newCell,
                                    position: op.position,
                                });
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

                    // First try to find by cell ID in cellOrder
                    let index = doc.notebook.cellOrder.indexOf(idOrName);
                    if (index >= 0) return index;

                    // Then try to find by newly created cell name
                    const cellId = newCellNames.get(idOrName);
                    if (cellId) {
                        index = doc.notebook.cellOrder.indexOf(cellId);
                        if (index >= 0) return index;
                    }

                    // Finally try to find by object/morphism name in existing cells
                    for (let i = 0; i < doc.notebook.cellOrder.length; i++) {
                        const cellId = doc.notebook.cellOrder[i];
                        const cell = doc.notebook.cellContents[cellId];
                        if (!cell) continue;

                        if (
                            cell.tag === "formal" &&
                            cell.content.tag === "object"
                        ) {
                            if (cell.content.name === idOrName) return i;
                        }
                        if (
                            cell.tag === "formal" &&
                            cell.content.tag === "morphism"
                        ) {
                            if (cell.content.name === idOrName) return i;
                        }
                    }

                    return -1;
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
                    // Add cells to cellContents
                    for (const cell of cells) {
                        doc.notebook.cellContents[cell.id] = cell;
                    }

                    // Get cell IDs to insert
                    const cellIds = cells.map((c) => c.id);

                    if ((op as any).position?.after) {
                        // Insert after specific cell ID/name
                        const afterIndex = findCellIndex(
                            (op as any).position.after
                        );
                        if ((op as any).position.after === "_start") {
                            // Special case: insert at beginning
                            doc.notebook.cellOrder.splice(0, 0, ...cellIds);
                            console.log(
                                `📍 Inserted ${cells.length} cell(s) at the beginning`
                            );
                        } else if (afterIndex >= 0) {
                            doc.notebook.cellOrder.splice(
                                afterIndex + 1,
                                0,
                                ...cellIds
                            );
                            console.log(
                                `📍 Inserted ${cells.length} cell(s) after: ${
                                    (op as any).position.after
                                }`
                            );
                        } else {
                            console.log(
                                `⚠️ Cell ${
                                    (op as any).position.after
                                } not found, adding at end`
                            );
                            doc.notebook.cellOrder.push(...cellIds);
                        }
                    } else if ((op as any).position?.before) {
                        // Insert before specific cell ID/name
                        const beforeIndex = findCellIndex(
                            (op as any).position.before
                        );
                        if (beforeIndex >= 0) {
                            doc.notebook.cellOrder.splice(
                                beforeIndex,
                                0,
                                ...cellIds
                            );
                            console.log(
                                `📍 Inserted ${cells.length} cell(s) before: ${
                                    (op as any).position.before
                                }`
                            );
                        } else {
                            console.log(
                                `⚠️ Cell ${
                                    (op as any).position.before
                                } not found, adding at end`
                            );
                            doc.notebook.cellOrder.push(...cellIds);
                        }
                    } else {
                        // Position is required, this should not happen
                        console.error(
                            `❌ Position is required for add operations`
                        );
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
                            console.log(
                                `🔍 Looking for cell to edit with ID: "${op.id}"`
                            );
                            validateAndLogId(op.id, "edit-cell operation ID");
                            const cell = doc.notebook.cellContents[op.id];
                            if (cell) {
                                validateAndLogId(
                                    cell.id,
                                    "found cell ID for editing"
                                );
                                console.log(
                                    `✏️ Editing cell ${op.id} with updates:`,
                                    op.updates
                                );

                                // Deep merge the updates into the cell
                                deepMerge(cell, op.updates);
                            } else {
                                console.log(
                                    `⚠️ Cell ${op.id} not found for editing`
                                );
                            }
                            break;

                        case "delete-cell":
                            console.log(
                                `🔍 Looking for cell to delete with ID: "${op.id}"`
                            );
                            validateAndLogId(op.id, "delete-cell operation ID");
                            const cellToDelete =
                                doc.notebook.cellContents[op.id];
                            if (cellToDelete) {
                                validateAndLogId(
                                    cellToDelete.id,
                                    "found cell ID for deletion"
                                );
                                // Remove from cellContents
                                delete doc.notebook.cellContents[op.id];
                                // Remove from cellOrder
                                const orderIndex =
                                    doc.notebook.cellOrder.indexOf(op.id);
                                if (orderIndex !== -1) {
                                    doc.notebook.cellOrder.splice(
                                        orderIndex,
                                        1
                                    );
                                }
                                console.log(`🗑️ Deleted cell with ID ${op.id}`);
                            } else {
                                console.log(
                                    `⚠️ Cell ${op.id} not found for deletion`
                                );
                            }
                            break;
                    }
                }

                console.log(
                    "✅ All power system operations completed successfully"
                );
            });
        },
    },
};
