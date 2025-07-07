/** @jsxRuntime automatic */
/** @jsxImportSource solid-js */
/* eslint-disable react/no-unknown-property */

import { createResource, Show } from "solid-js";
import type { Repo } from "@automerge/automerge-repo";

import { ApiContext } from "../../src/api";
import { stdTheories, TheoryLibraryContext } from "../../src/stdlib";
import { getLiveAnalysis } from "../../src/analysis";
import {
    AnalysisDocumentEditor,
    AnalysisNotebookEditor,
} from "../../src/analysis/analysis_editor";

// Import necessary CSS for CatColab components
import "../../src/index.css";
import "../../src/notebook/notebook_editor.css";
import "../../src/notebook/notebook_cell.css";
import "../../src/model/model_editor.css";
import "../../src/model/object_cell_editor.css";
import "../../src/model/morphism_cell_editor.css";
import "../../src/stdlib/arrow_styles.module.css";
import "../../src/components/form.css";
import "../../src/components/fixed_table_editor.css";
import "../../src/stdlib/analyses/simulation.css";
import "../../src/stdlib/analyses/submodel_graphs.css";

interface AnalysisPaneProps {
    docUrl: string;
    repo: Repo;
}

export function AnalysisPaneComponent(props: AnalysisPaneProps) {
    const api = { repo: props.repo };
    const [liveAnalysis] = createResource(
        () => props.docUrl,
        async (refId) => {
            try {
                const result = await getLiveAnalysis(refId, api, stdTheories);
                return result;
            } catch (error) {
                throw error;
            }
        }
    );

    return (
        <div>
            <div>
                <Show when={liveAnalysis.loading}>
                    <div>⏳ Loading analysis...</div>
                </Show>
                <Show when={liveAnalysis.error}>
                    <div>
                        ❌ Error loading model:{" "}
                        {liveAnalysis.error?.message || "Unknown error"}
                    </div>
                </Show>
                <Show
                    when={
                        liveAnalysis() &&
                        !liveAnalysis.loading &&
                        !liveAnalysis.error
                    }
                >
                    {(loadedAnalysis) => {
                        // Provide contexts using SAME import paths as ModelPane
                        return (
                            <ApiContext.Provider value={api}>
                                <TheoryLibraryContext.Provider
                                    value={stdTheories}
                                >
                                    <AnalysisNotebookEditor
                                        liveAnalysis={liveAnalysis()}
                                    />
                                </TheoryLibraryContext.Provider>
                            </ApiContext.Provider>
                        );
                    }}
                </Show>
            </div>
        </div>
    );
}
