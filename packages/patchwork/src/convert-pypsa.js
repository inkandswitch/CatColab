import * as hdf5 from "https://esm.sh/h5wasm";
import * as catColab from "https://patchwork.inkandswitch.com/automerge/automerge:So2FT1x3Xon2GzrogpVUveu1wM1/dist/stdlib.js";

// Ensure the WASM module is ready before using h5wasm functions
await hdf5.ready;

export default async function ({ folderUrl, dataUrl }) {
    console.log("catColab loaded ", catColab);
    if (catColab.__tla) await catColab.__tla;
    catColab.installStdlibWorkerShim();

    const repo = globalThis.repo;
    if (!repo) {
        throw new Error("Expected globalThis.repo to be defined in the worker");
    }
    const actions = catColab.actions ?? catColab.workerStdlib?.actions;
    if (!actions?.addCell) {
        throw new Error("CatColab actions not available in worker stdlib");
    }

    const theory = await catColab.workerStdlib.stdTheories.get("petri-net");
    console.log("Loaded theory:", theory.id);

    const handle = await repo.find(dataUrl);
    const { name: fileName, content: fileData } = handle.doc();
    hdf5.FS.writeFile(fileName, fileData);
    const h5file = new hdf5.File(fileName, "r");

    const buses_i = h5file.get("buses_i").value;

    // Create bus name to index mapping
    const busNameToIndex = {};
    buses_i.forEach((name, idx) => {
        busNameToIndex[name] = idx;
    });

    // Extract transmission lines (transitions)
    const transitions = [];
    const lineNames = ["lines_bus0", "line_bus0", "links_bus0", "link_bus0"];

    for (const baseName of lineNames) {
        try {
            if (h5file.get(baseName)) {
                const bus1Name = baseName.replace("bus0", "bus1");

                if (h5file.get(bus1Name)) {
                    const bus0Indices = h5file.get(baseName).value;
                    const bus1Indices = h5file.get(bus1Name).value;

                    // Try to get additional line attributes
                    let lineCapacities = null;
                    let lineVoltages = null;

                    try {
                        const capacityName = baseName.replace("bus0", "s_nom");
                        if (h5file.get(capacityName)) {
                            lineCapacities = h5file.get(capacityName).value;
                        }
                    } catch (e) {}

                    try {
                        const voltageName = baseName.replace("bus0", "v_nom");
                        if (h5file.get(voltageName)) {
                            lineVoltages = h5file.get(voltageName).value;
                        }
                    } catch (e) {}

                    for (
                        let i = 0;
                        i < Math.min(bus0Indices.length, bus1Indices.length);
                        i++
                    ) {
                        const busName0 = bus0Indices[i];
                        const busName1 = bus1Indices[i];

                        const idx0 = busNameToIndex[busName0];
                        const idx1 = busNameToIndex[busName1];

                        if (idx0 !== undefined && idx1 !== undefined) {
                            const isLine = baseName.includes("line");
                            const capacity = lineCapacities
                                ? lineCapacities[i]
                                : null;
                            const voltage = lineVoltages
                                ? lineVoltages[i]
                                : null;

                            // Determine line width based on capacity if available
                            let lineWidth = 2;
                            if (capacity && !isNaN(capacity)) {
                                lineWidth = Math.max(
                                    1,
                                    Math.min(6, Math.sqrt(capacity / 100))
                                );
                            }

                            transitions.push({
                                source: busName0,
                                target: busName1,
                                name: `${busName0} -> ${busName1}`,
                                capacity,
                                voltage,
                            });
                        }
                    }
                    break; // Use first found dataset
                }
            }
        } catch (e) {
            console.log(`No ${baseName} dataset found or error reading it`);
        }
    }

    const analysisDocHandle = repo.create({});
    await analysisDocHandle.change((doc) => {
        doc.type = "analysis";
        doc.name = `Analysis of ${fileName}`;
        doc.theory = "petri-net";
        doc.analysisType = "model";
        doc.notebook = { cells: [] };
    });

    const modelDocHandle = repo.create({});
    await modelDocHandle.change((doc) => {
        doc.type = "model";
        doc.name = `Petri net for ${fileName}`;
        doc.theory = "petri-net";
        doc.version = "1";
        doc.notebook = { cellOrder: [], cellContents: {} };
        doc.analysisDocUrl = analysisDocHandle.url;
    });

    const placeCells = buses_i.map((busName) => ({
        cellType: "Place",
        name: busName,
    }));

    if (placeCells.length > 0) {
        await actions.addCells(modelDocHandle, repo, placeCells);
    }

    const transitionCells = transitions.map((transition) => ({
        cellType: "Transition",
        name: transition.name,
        dom: transition.source,
        cod: transition.target,
    }));

    if (transitionCells.length > 0) {
        await actions.addCells(modelDocHandle, repo, transitionCells);
    }

    const folderHandle = await repo.find(folderUrl);
    folderHandle.change((f) =>
        f.docs.push({
            url: modelDocHandle.url,
            name: modelDocHandle.doc().name,
            type: "catcolab-model",
        })
    );

    return modelDocHandle.url;
}
