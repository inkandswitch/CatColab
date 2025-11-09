import { createEffect, createResource, Show } from "solid-js";

import { AnalysisNotebookEditor } from "../../frontend/src/analysis/analysis_editor";
import { getLiveAnalysisFromRepo } from "../../frontend/src/analysis";
import { createModelLibraryWithRepo } from "../../frontend/src/model";
import { stdTheories } from "../../frontend/src/stdlib";
import { TheoryLibraryContext } from "../../frontend/src/theory";
import type { SolidToolProps } from "./tools";
import { AnnotationsContext } from "./annotations_solid";

export function AnalysisPaneComponent(props: SolidToolProps) {
    const models = createModelLibraryWithRepo(props.repo as any, stdTheories);

    const [liveAnalysis] = createResource(
        () => props.docUrl,
        async (docUrl) => {
            try {
                const result = await getLiveAnalysisFromRepo(
                    docUrl as any,
                    props.repo as any,
                    models
                );
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
                    {(_) => {
                        // Provide contexts using SAME import paths as ModelPane
                        return (
                            <AnnotationsContext.Provider
                                value={props.annotationsContextValue}
                            >
                                <TheoryLibraryContext.Provider
                                    value={stdTheories}
                                >
                                    <AnalysisNotebookEditor
                                        liveAnalysis={liveAnalysis()!}
                                        annotations={props.annotations}
                                    />
                                </TheoryLibraryContext.Provider>
                            </AnnotationsContext.Provider>
                        );
                    }}
                </Show>
            </div>
        </div>
    );
}
