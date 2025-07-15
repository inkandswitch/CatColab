import { Accessor, createEffect, createResource, Show } from "solid-js";

import type { Repo } from "@automerge/automerge-repo";
import { Annotation } from "@patchwork/sdk/versionControl";
import { Cell, Uuid } from "catlog-wasm";
import { ApiContext } from "../../frontend/src/api";
import { getLiveModel } from "../../frontend/src/model/document";
import { ModelPane } from "../../frontend/src/model/model_editor";
import { stdTheories, TheoryLibraryContext } from "../../frontend/src/stdlib";
import { getLiveAnalysis } from "../../frontend/src/analysis";
import { Doc } from "./datatype";
import { init as initAnalysis, Doc as AnalysisDoc } from "./analysis-datatype";
import { AnalysisNotebookEditor } from "../../frontend/src/analysis/analysis_editor";

interface ModelPaneProps {
    docUrl: string;
    repo: Repo;
    annotations: Accessor<Annotation<Uuid, Cell<unknown>>[]>;
    onAddComment: (cellId: Uuid) => void;
}

export function ModelPaneComponent(props: ModelPaneProps) {
    const api = { repo: props.repo };

    const [liveModel] = createResource(
        () => props.docUrl,
        async (refId) => {
            try {
                return await getLiveModel(refId, api, stdTheories);
            } catch (error) {
                console.error("=== Model Loading Failed ===");
                console.error("Error:", error);
                console.error("Stack:", (error as Error).stack);
                throw error;
            }
        }
    );

    const [liveAnalysis] = createResource(
        () => (liveModel()?.liveDoc.doc as Doc)?.analysisDocUrl,
        async (refId) => {
            if (!refId) return null;

            try {
                const result = await getLiveAnalysis(refId, api, stdTheories);
                return result;
            } catch (error) {
                throw error;
            }
        }
    );

    const isLoading = () =>
        liveModel.loading || liveAnalysis.loading || !liveAnalysis();

    const hasError = () => liveModel.error || liveAnalysis.error;

    const isEverythingLoaded = () => !isLoading() && !hasError();

    const isModelLoaded = () => !liveModel.loading && !liveModel.error;

    // we can't create the analysis doc in the init function because
    // the analysis doc needs a reference to the model doc and in the init we don't have an url for the model doc yet
    createEffect(() => {
        if (
            !isModelLoaded() ||
            (liveModel()?.liveDoc.doc as Doc)?.analysisDocUrl
        ) {
            return;
        }

        const analysisDocHandle = props.repo.create<AnalysisDoc>();
        analysisDocHandle.change((doc) => {
            initAnalysis(doc);

            doc.analysisType = "model";
            doc.analysisOf = {
                _id: liveModel()?.liveDoc.docHandle.url!,
            };
        });

        liveModel()?.liveDoc.changeDoc((doc) => {
            (doc as Doc).analysisDocUrl = analysisDocHandle.url;
        });
    });

    return (
        <div>
            <div>
                <Show when={isLoading()}>
                    <div>⏳ Loading model...</div>
                </Show>
                <Show when={hasError()}>
                    <Show when={liveModel.error}>
                        <div>
                            ❌ Error loading model:{" "}
                            {liveModel.error?.message || "Unknown error"}
                        </div>
                    </Show>

                    <Show when={liveAnalysis.error}>
                        <div>
                            ❌ Error loading analysis:{" "}
                            {liveAnalysis.error?.message || "Unknown error"}
                        </div>
                    </Show>
                </Show>
                <Show when={isEverythingLoaded()}>
                    {(_) => {
                        return (
                            <ApiContext.Provider value={api}>
                                <TheoryLibraryContext.Provider
                                    value={stdTheories}
                                >
                                    <ModelPane
                                        liveModel={liveModel()!}
                                        annotations={props.annotations}
                                        onAddComment={props.onAddComment}
                                    />
                                    <h1>Analysis</h1>
                                    <AnalysisNotebookEditor
                                        liveAnalysis={liveAnalysis()!}
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
