import { AnnotationsViewProps } from "@patchwork/sdk/annotations";
import { Cell, Uuid } from "catlog-wasm";
import React from "react";
import { Component, createResource, For, Match, Show, Switch } from "solid-js";
import { AnnotationsPluginImplementation } from "../../../../patchwork/sdk/dist/annotations/types";
import {
    createModelLibraryWithRepo,
    LiveModelContext,
} from "../../frontend/src/model";
import { ModelCellEditor } from "../../frontend/src/model/model_editor";
import {
    CellActions,
    FormalCell,
    RichTextCell,
} from "../../frontend/src/notebook";
import { stdTheories } from "../../frontend/src/stdlib";
import { TheoryLibraryContext } from "../../frontend/src/theory";
import {
    CellAnnotationsViewProps,
    CellAnnotationsViewWrapper,
    CellPointer,
    patchesToAnnotation,
} from "./annotations";
import { ModelDoc } from "./model_datatype";

export function AnnotationsView({
    annotations,
    docUrl,
}: AnnotationsViewProps<ModelDoc, Uuid, Cell<unknown>>) {
    return React.createElement(CellAnnotationsViewWrapper, {
        annotations,
        docUrl,
        CellAnnotationsView,
    });
}

const CellView: Component<{
    cell: Cell<unknown>;
}> = ({ cell }) => {
    return (
        <Switch>
            <Match when={cell.tag === "rich-text"}>
                <div>{(cell as RichTextCell).content}</div>
            </Match>
            <Match when={cell.tag === "formal"}>
                <ModelCellEditor
                    content={(cell as FormalCell<any>).content}
                    changeContent={(_) => {}}
                    isActive={false}
                    actions={{} as CellActions}
                />
            </Match>
        </Switch>
    );
};

function CellAnnotationsView(props: CellAnnotationsViewProps) {
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

    console.log("annotations view", props);

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
                            <TheoryLibraryContext.Provider value={stdTheories}>
                                <LiveModelContext.Provider
                                    value={() => liveModel()!}
                                >
                                    <For each={props.annotations}>
                                        {(annotation) => {
                                            switch (annotation.type) {
                                                case "added":
                                                    return (
                                                        <div class="annotation annotation-added">
                                                            <CellView
                                                                cell={
                                                                    annotation
                                                                        .pointer
                                                                        .value
                                                                }
                                                            />
                                                        </div>
                                                    );
                                                case "deleted":
                                                    return (
                                                        <div class="annotation annotation-deleted">
                                                            <CellView
                                                                cell={
                                                                    annotation
                                                                        .pointer
                                                                        .value
                                                                }
                                                            />
                                                        </div>
                                                    );
                                                case "changed":
                                                    return (
                                                        <div class="annotation-group">
                                                            <div class="annotation-label">
                                                                Before
                                                            </div>
                                                            <div class="annotation">
                                                                <CellView
                                                                    cell={
                                                                        annotation
                                                                            .before
                                                                            .value
                                                                    }
                                                                />
                                                            </div>
                                                            <div class="annotation-label">
                                                                After
                                                            </div>
                                                            <div class="annotation annotation-changed">
                                                                <CellView
                                                                    cell={
                                                                        annotation
                                                                            .after
                                                                            .value
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                case "comment":
                                                    if (
                                                        props.annotations.some(
                                                            (annotation) =>
                                                                annotation.type !==
                                                                "comment"
                                                        )
                                                    ) {
                                                        return null;
                                                    }

                                                    return (
                                                        <div class="annotation">
                                                            <For
                                                                each={
                                                                    annotation
                                                                        .discussion
                                                                        .pointers
                                                                }
                                                            >
                                                                {(pointer) => (
                                                                    <div class="annotation">
                                                                        <CellView
                                                                            cell={
                                                                                pointer.value as Cell<unknown>
                                                                            }
                                                                        />
                                                                    </div>
                                                                )}
                                                            </For>
                                                        </div>
                                                    );
                                            }
                                        }}
                                    </For>
                                </LiveModelContext.Provider>
                            </TheoryLibraryContext.Provider>
                        );
                    }}
                </Show>
            </div>
        </div>
    );
}

export const plugin: AnnotationsPluginImplementation<
    ModelDoc,
    Uuid,
    Cell<unknown>
> = {
    patchesToAnnotation: patchesToAnnotation<ModelDoc>,
    targetToPointer: (doc, target): CellPointer<ModelDoc> =>
        new CellPointer<ModelDoc>(doc, target),
    AnnotationsView,
};
