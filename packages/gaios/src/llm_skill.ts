// The "llm:skill" plugin for Patchwork's chat computer: instructions for
// creating and editing CatColab stock-and-flow models and their mass-action
// analyses with the chat's generic document tools (read_doc / automerge_op).
// Auto-activates when the focused document is a catcolab-model or
// catcolab-analysis (see the registration in index.ts).

const INSTRUCTIONS = `
Create and edit CatColab stock-and-flow models (system dynamics) and their
mass-action simulation analyses. Edit the documents directly with read_doc and
automerge_op; the CatColab tool renders your changes live.

### Model document

{ "type": "model", "name": "...", "theory": "primitive-stock-flow",
  "version": "2", "notebook": { "cellOrder": ["<cellId>", ...],
  "cellContents": { "<cellId>": <cell>, ... } },
  "@patchwork": { "type": "catcolab-model", ... } }

A cell is { "id": "<cellId>", "tag": "formal", "content": { ... } } or
{ "id": "<cellId>", "tag": "rich-text", "content": "prose" }.

CRITICAL id rule: every formal cell has TWO UUIDs — the OUTER cell id (the
cellContents key, the cellOrder entry, and the envelope's "id") and the INNER
content.id. All cross-references (a flow's dom/cod, a link's target, analysis
parameter tables) use the INNER content.id, never the cell id. Generate fresh
UUIDs in the same format as the existing ones; the two must differ.

Three constructs:

Stock (anything that accumulates):
{ "tag": "object", "id": "<stockId>", "name": "Headcount",
  "obType": { "tag": "Basic", "content": "Object" } }

Flow (moves substance from stock dom to stock cod; both required — add
reservoir/sink stocks for exogenous in/outflows):
{ "tag": "morphism", "id": "<flowId>", "name": "hiring",
  "morType": { "tag": "Hom", "content": { "tag": "Basic", "content": "Object" } },
  "dom": { "tag": "Basic", "content": "<sourceStockId>" },
  "cod": { "tag": "Basic", "content": "<targetStockId>" } }

Link (stock multiplies a flow's rate without being consumed; name "" by
convention; cod wraps the FLOW's content id in Tabulated):
{ "tag": "morphism", "id": "<linkId>", "name": "",
  "morType": { "tag": "Basic", "content": "Link" },
  "dom": { "tag": "Basic", "content": "<influencingStockId>" },
  "cod": { "tag": "Tabulated", "content": { "tag": "Basic", "content": "<flowId>" } } }

### Editing recipes (automerge_op)

Add a cell = two ops:
1. path ["notebook","cellContents"], range "<newCellId>", value = the full cell.
2. path ["notebook","cellOrder"], range [N,N], value ["<newCellId>"]
   (N = current cellOrder length to append; read_doc first).

Rename: path ["notebook","cellContents","<cellId>","content"], range "name".
Remove: delete the cellContents key AND splice its cellOrder entry; also remove
flows/links whose dom/cod reference the removed content id, and the entity's
analysis parameter entries. Never change "@patchwork".type and never touch
"@patchwork".mainDraftUrl / frozenImportUrl.

### Simulation semantics (Balanced mass action)

A flow f: A -> B with rate r moves r * A * (product of linked stock values)
per time unit — subtracted from A, added to B. Every flow is proportional to
its source stock; for a near-constant inflow give the reservoir a large
initial value and a small rate so depletion is negligible. Rates and initial
values must be >= 0. Time units are arbitrary — pick one and state it. Choose
parameters by reasoning about the ODE (e.g. equilibrium: inflow = outflow at
the target level) and report that reasoning to the user.

### Analysis document

{ "type": "analysis", "analysisType": "model", "name": "", "version": "2",
  "analysisOf": { "type": "analysis-of", "_id": "automerge:<modelDocId>",
    "_server": "", "_version": null },
  "notebook": { ... }, "@patchwork": { "type": "catcolab-analysis", ... } }

The model points back via its top-level analysisDocUrl (the CatColab tool
creates the analysis automatically when a model is first opened). Analysis
cells are envelopes whose content is { "id": "<kind>", "content": { ... } }
with kinds: "diagram" ({ "layout": "graphviz-directed" }), "mass-action"
(the simulation, below), "mass-action-equations"
({ "massConservationType": { "type": "Balanced" } }).

mass-action content — parameter tables are keyed by INNER content ids:
{ "duration": 10, "initialValues": { "<stock content id>": 1 },
  "rates": { "<flow content id>": 1 },
  "massConservationType": { "type": "Balanced" },
  "placeConsumptionRates": {}, "placeProductionRates": {},
  "transitionConsumptionRates": {}, "transitionProductionRates": {} }

Give EVERY stock an initialValues entry and EVERY flow a rates entry — after
adding entities to the model, backfill these tables. Example: set a rate with
path ["notebook","cellContents","<massActionCellId>","content","content","rates"],
range "<flow content id>", value 0.01. Change the duration with
path [...,"content","content"], range "duration".

### Worked example — SEIRV (all three constructs)

{ "name": "SEIRV", "type": "model", "theory": "primitive-stock-flow", "version": "2", "notebook": {
  "cellOrder": ["0194d7c1-3b04-77cf-b2c1-e4e8a10712e2","0194d7a9-bc26-73ac-b2b8-73470cb412ae","0194fc13-3da9-77cb-b36a-9c5b8a74d941","0194d7a9-bf28-709f-b34d-545928dd7c16","0194d7a9-c036-745b-99e2-b3ef2d3b87d0","0194fc13-2920-724c-a6c3-fc1d17699223","0194d7a9-d72e-700a-9c8b-7686fad4193b","0194fc14-204c-72a4-92fa-df5491673bab","0194fc13-d6aa-741c-a30c-54cd59aaee10","0194d7a9-d8b5-741f-916f-d559d3ff2f8d","0194d7a9-f4ff-77df-80a5-75410f4b9680","01981982-b589-702c-99a8-57983e3bd08e"],
  "cellContents": {
    "0194d7c1-3b04-77cf-b2c1-e4e8a10712e2": { "id": "0194d7c1-3b04-77cf-b2c1-e4e8a10712e2", "tag": "rich-text", "content": "The standard SIR epidemiology model augmented with Exposed and Vaccinated populations. A link from Infectious to the exposure process makes the exposure rate grow with the infectious density." },
    "0194d7a9-bc26-73ac-b2b8-73470cb412ae": { "id": "0194d7a9-bc26-73ac-b2b8-73470cb412ae", "tag": "formal", "content": { "tag": "object", "id": "0194d7a9-bc26-73ac-b2b8-6eb9a514827b", "name": "Susceptible", "obType": { "tag": "Basic", "content": "Object" } } },
    "0194fc13-3da9-77cb-b36a-9c5b8a74d941": { "id": "0194fc13-3da9-77cb-b36a-9c5b8a74d941", "tag": "formal", "content": { "tag": "object", "id": "0194fc13-3da9-77cb-b36a-9b8a6a83f0e6", "name": "Exposed", "obType": { "tag": "Basic", "content": "Object" } } },
    "0194d7a9-bf28-709f-b34d-545928dd7c16": { "id": "0194d7a9-bf28-709f-b34d-545928dd7c16", "tag": "formal", "content": { "tag": "object", "id": "0194d7a9-bf28-709f-b34d-513c3da75e9c", "name": "Infectious", "obType": { "tag": "Basic", "content": "Object" } } },
    "0194d7a9-c036-745b-99e2-b3ef2d3b87d0": { "id": "0194d7a9-c036-745b-99e2-b3ef2d3b87d0", "tag": "formal", "content": { "tag": "object", "id": "0194d7a9-c036-745b-99e2-aedb526915c7", "name": "Recovered", "obType": { "tag": "Basic", "content": "Object" } } },
    "0194fc13-2920-724c-a6c3-fc1d17699223": { "id": "0194fc13-2920-724c-a6c3-fc1d17699223", "tag": "formal", "content": { "tag": "object", "id": "0194fc13-2920-724c-a6c3-f85ca780f6cf", "name": "Vaccinated", "obType": { "tag": "Basic", "content": "Object" } } },
    "0194d7a9-d72e-700a-9c8b-7686fad4193b": { "id": "0194d7a9-d72e-700a-9c8b-7686fad4193b", "tag": "formal", "content": { "tag": "morphism", "id": "0194d7a9-d72e-700a-9c8b-703b753da038", "name": "exposure", "morType": { "tag": "Hom", "content": { "tag": "Basic", "content": "Object" } }, "dom": { "tag": "Basic", "content": "0194d7a9-bc26-73ac-b2b8-6eb9a514827b" }, "cod": { "tag": "Basic", "content": "0194fc13-3da9-77cb-b36a-9b8a6a83f0e6" } } },
    "0194fc14-204c-72a4-92fa-df5491673bab": { "id": "0194fc14-204c-72a4-92fa-df5491673bab", "tag": "formal", "content": { "tag": "morphism", "id": "0194fc14-204c-72a4-92fa-da1399afa430", "name": "vaccination", "morType": { "tag": "Hom", "content": { "tag": "Basic", "content": "Object" } }, "dom": { "tag": "Basic", "content": "0194d7a9-bc26-73ac-b2b8-6eb9a514827b" }, "cod": { "tag": "Basic", "content": "0194fc13-2920-724c-a6c3-f85ca780f6cf" } } },
    "0194fc13-d6aa-741c-a30c-54cd59aaee10": { "id": "0194fc13-d6aa-741c-a30c-54cd59aaee10", "tag": "formal", "content": { "tag": "morphism", "id": "0194fc13-d6aa-741c-a30c-536d48c10c1e", "name": "infection", "morType": { "tag": "Hom", "content": { "tag": "Basic", "content": "Object" } }, "dom": { "tag": "Basic", "content": "0194fc13-3da9-77cb-b36a-9b8a6a83f0e6" }, "cod": { "tag": "Basic", "content": "0194d7a9-bf28-709f-b34d-513c3da75e9c" } } },
    "0194d7a9-d8b5-741f-916f-d559d3ff2f8d": { "id": "0194d7a9-d8b5-741f-916f-d559d3ff2f8d", "tag": "formal", "content": { "tag": "morphism", "id": "0194d7a9-d8b5-741f-916f-d3dd802450ec", "name": "recovery", "morType": { "tag": "Hom", "content": { "tag": "Basic", "content": "Object" } }, "dom": { "tag": "Basic", "content": "0194d7a9-bf28-709f-b34d-513c3da75e9c" }, "cod": { "tag": "Basic", "content": "0194d7a9-c036-745b-99e2-aedb526915c7" } } },
    "0194d7a9-f4ff-77df-80a5-75410f4b9680": { "id": "0194d7a9-f4ff-77df-80a5-75410f4b9680", "tag": "formal", "content": { "tag": "morphism", "id": "0194d7a9-f4ff-77df-80a5-70d50473ed6d", "name": "", "morType": { "tag": "Basic", "content": "Link" }, "dom": { "tag": "Basic", "content": "0194d7a9-bf28-709f-b34d-513c3da75e9c" }, "cod": { "tag": "Tabulated", "content": { "tag": "Basic", "content": "0194d7a9-d72e-700a-9c8b-703b753da038" } } } },
    "01981982-b589-702c-99a8-57983e3bd08e": { "id": "01981982-b589-702c-99a8-57983e3bd08e", "tag": "formal", "content": { "tag": "morphism", "id": "01981982-b589-702c-99a8-539c45521dc9", "name": "waning", "morType": { "tag": "Hom", "content": { "tag": "Basic", "content": "Object" } }, "dom": { "tag": "Basic", "content": "0194fc13-2920-724c-a6c3-f85ca780f6cf" }, "cod": { "tag": "Basic", "content": "0194d7a9-bc26-73ac-b2b8-6eb9a514827b" } } }
  } }

### Workflow

1. read_doc the focused document. For a model, also read_doc its
   analysisDocUrl (if present) before touching parameters; for an analysis,
   read_doc analysisOf._id to see the model.
2. Plan the stocks/flows/links and the parameter math; explain both briefly.
3. Apply edits cell by cell with automerge_op (two ops per new cell).
4. Backfill the analysis's initialValues/rates for anything you added, keyed
   by INNER content ids.
5. read_doc to verify, then summarize what changed.
`.trim();

export const skill = {
    instructions: INSTRUCTIONS,
};
