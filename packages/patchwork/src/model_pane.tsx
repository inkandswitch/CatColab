import { createResource, Show } from "solid-js";

import { ModelPane } from "../../frontend/src/model/model_editor";
import { createModelLibraryWithRepo } from "../../frontend/src/model";
import { stdTheories } from "../../frontend/src/stdlib";
import { TheoryLibraryContext } from "../../frontend/src/theory";
import { AnnotationsContext } from "./annotations_solid";
import { SolidToolProps } from "./tools";

export function ModelPaneComponent(props: SolidToolProps) {
    const models = createModelLibraryWithRepo(props.repo as any, stdTheories);

    const [liveModel] = createResource(
        () => props.docUrl,
        async (docUrl) => {
            try {
                return await models.getLiveModel(docUrl as any);
            } catch (error) {
                console.error("=== Model Loading Failed ===");
                console.error("Error:", error);
                console.error("Stack:", (error as Error).stack);
                throw error;
            }
        }
    );

    const isLoading = () => liveModel.loading || !liveModel();

    const hasError = () => liveModel.error;

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
                </Show>
                <Show when={!isLoading()}>
                    {(_) => {
                        return (
                            <AnnotationsContext.Provider
                                value={props.annotationsContextValue}
                            >
                                <TheoryLibraryContext.Provider
                                    value={stdTheories}
                                >
                                    <ModelPane liveModel={liveModel()!} />
                                </TheoryLibraryContext.Provider>
                            </AnnotationsContext.Provider>
                        );
                    }}
                </Show>
            </div>
        </div>
    );
}
