import { Accessor, createResource, Show } from "solid-js";

import type { Repo } from "@automerge/automerge-repo";
import { Annotation } from "@patchwork/sdk/versionControl";
import { Cell, Uuid } from "catlog-wasm";
import { ApiContext } from "../../frontend/src/api";
import { getLiveModel } from "../../frontend/src/model/document";
import { ModelPane } from "../../frontend/src/model/model_editor";
import { stdTheories, TheoryLibraryContext } from "../../frontend/src/stdlib";

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
                                </TheoryLibraryContext.Provider>
                            </ApiContext.Provider>
                        );
                    }}
                </Show>
            </div>
        </div>
    );
}
