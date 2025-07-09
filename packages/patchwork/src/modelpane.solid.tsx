import { Accessor, createResource, onMount, Show } from "solid-js";

import type { Repo } from "@automerge/automerge-repo";
import { Annotation } from "@patchwork/sdk/versionControl";
import { Cell, Uuid } from "catlog-wasm";
import { ApiContext } from "../../frontend/src/api";
import { LiveModelContext } from "../../frontend/src/model/context";
import { getLiveModel } from "../../frontend/src/model/document";
import { ModelPane } from "../../frontend/src/model/model_editor";
import { stdTheories, TheoryLibraryContext } from "../../frontend/src/stdlib";

interface ModelPaneProps {
    docUrl: string;
    repo: Repo;
    annotations: Accessor<Annotation<Uuid, Cell<unknown>>[]>;
}

export function ModelPaneComponent(props: ModelPaneProps) {
    const api = { repo: props.repo };

    onMount(() => {
        console.log("=== ModelPane Mount (Same Import Paths) ===");
    });

    const [liveModel] = createResource(
        () => props.docUrl,
        async (refId) => {
            try {
                const result = await getLiveModel(refId, api, stdTheories);
                console.log("=== Model Loaded Successfully ===");
                console.log("Result:", result);
                return result;
            } catch (error) {
                console.error("=== Model Loading Failed ===");
                console.error("Error:", error);
                console.error("Stack:", (error as Error).stack);
                throw error;
            }
        }
    );

    return (
        <div>
            <div>
                <Show when={liveModel.loading}>
                    <div>⏳ Loading model...</div>
                </Show>
                <Show when={liveModel.error}>
                    <div>
                        ❌ Error loading model:{" "}
                        {liveModel.error?.message || "Unknown error"}
                    </div>
                </Show>
                <Show
                    when={liveModel() && !liveModel.loading && !liveModel.error}
                >
                    {(loadedModel) => {
                        console.log(
                            "=== Rendering ModelPane (Context Identity Debug) ==="
                        );
                        console.log("LoadedModel:", loadedModel());
                        console.log("About to provide contexts...");
                        console.log(
                            "TheoryLibraryContext (provider):",
                            TheoryLibraryContext
                        );
                        console.log("ApiContext (provider):", ApiContext);
                        console.log(
                            "LiveModelContext (provider):",
                            LiveModelContext
                        );

                        // Provide contexts using SAME import paths as ModelPane
                        return (
                            <ApiContext.Provider value={api}>
                                <TheoryLibraryContext.Provider
                                    value={stdTheories}
                                >
                                    <ModelPane
                                        liveModel={liveModel()!}
                                        annotations={props.annotations}
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
