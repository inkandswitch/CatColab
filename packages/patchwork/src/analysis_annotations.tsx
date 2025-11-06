import type { AnnotationsViewProps } from "@patchwork/sdk/annotations";
import type { Cell, Uuid } from "catlog-wasm";
import React from "react";
import {
    type Component,
    createResource,
    For,
    Match,
    Show,
    Switch,
} from "solid-js";
import type { AnnotationsPluginImplementation } from "@patchwork/sdk/annotations";
import { AnalysisCellEditor } from "../../frontend/src/analysis/analysis_editor";
import { LiveAnalysisContext } from "../../frontend/src/analysis/context";
import { getLiveAnalysisFromRepo } from "../../frontend/src/analysis/document";
import { createModelLibraryWithRepo } from "../../frontend/src/model";
import type { CellActions, RichTextCell } from "../../frontend/src/notebook";
import { stdTheories } from "../../frontend/src/stdlib";
import { TheoryLibraryContext } from "../../frontend/src/theory";
import type { AnalysisDoc } from "./analysis_datatype";
import {
    type CellAnnotationsViewProps,
    CellAnnotationsViewWrapper,
    CellPointer,
    patchesToAnnotation,
} from "./annotations";

export function AnnotationsView({
    annotations,
    docUrl,
}: AnnotationsViewProps<AnalysisDoc, Uuid, Cell<unknown>>) {
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
                <AnalysisCellEditor
                    content={(cell as any).content}
                    changeContent={() => {}}
                    isActive={false}
                    actions={{} as CellActions}
                />
            </Match>
        </Switch>
    );
};

function CellAnnotationsView(props: CellAnnotationsViewProps) {
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
                        return (
                            <TheoryLibraryContext.Provider value={stdTheories}>
                                <LiveAnalysisContext.Provider
                                    value={() => liveAnalysis()!}
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
                                </LiveAnalysisContext.Provider>
                            </TheoryLibraryContext.Provider>
                        );
                    }}
                </Show>
            </div>
        </div>
    );
}

export const plugin: AnnotationsPluginImplementation<
    AnalysisDoc,
    Uuid,
    Cell<unknown>
> = {
    patchesToAnnotation: patchesToAnnotation<AnalysisDoc>,
    targetToPointer: (doc, target): CellPointer<AnalysisDoc> =>
        new CellPointer<AnalysisDoc>(doc, target),
    AnnotationsView,
};
