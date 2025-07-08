/** @jsxRuntime automatic */
/** @jsxImportSource solid-js */
/* eslint-disable react/no-unknown-property */

import { createSignal, onMount, createResource, Show } from "solid-js";

import { ApiContext } from "../../src/api";
import { stdTheories, TheoryLibraryContext } from "../../src/stdlib";
import { LiveModelContext } from "../../src/model/context";
import { ModelPane } from "../../src/model/model_editor";
import { getLiveModel } from "../../src/model/document";
import type { Repo } from "@automerge/automerge-repo";
import { Annotation } from "@patchwork/sdk/versionControl";
import { Cell, Uuid } from "catlog-wasm";

interface ModelPaneProps {
    docUrl: string;
    repo: Repo;
    annotations: Annotation<Uuid, Cell<unknown>>[];
}

export function ModelPaneComponent(props: ModelPaneProps) {
    const [mounted, setMounted] = createSignal(false);

    const api = { repo: props.repo };
    const annotations = props.annotations;

    onMount(() => {
        setMounted(true);
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
                                        annotations={annotations}
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
