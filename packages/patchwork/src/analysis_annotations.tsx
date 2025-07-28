import { AnnotationsViewProps } from "@patchwork/sdk/annotations";
import { Cell, Uuid } from "catlog-wasm";
import React from "react";
import { Component, createResource, For, Show, Switch } from "solid-js";
import { AnnotationsPluginImplementation } from "../../../../patchwork/sdk/dist/annotations/types";
import { AnalysisCellEditor } from "../../frontend/src/analysis/analysis_editor";
import { LiveAnalysisContext } from "../../frontend/src/analysis/context";
import { getLiveAnalysis } from "../../frontend/src/analysis/document";
import { ApiContext } from "../../frontend/src/api";
import { CellActions } from "../../frontend/src/notebook";
import { stdTheories, TheoryLibraryContext } from "../../frontend/src/stdlib";
import { AnalysisDoc } from "./analysis_datatype";
import {
    CellAnnotationsViewProps,
    CellAnnotationsViewWrapper,
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
            <AnalysisCellEditor
                content={cell.content}
                changeContent={() => {}}
                isActive={false}
                actions={{} as CellActions}
            />
        </Switch>
    );
};

function CellAnnotationsView(props: CellAnnotationsViewProps) {
    // Typescript gets confused because the patchwork and the frontend package both import "@automerge/automerge-repo" in their package.json
    const api = { repo: props.repo as any };
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
                    {(_) => {
                        return (
                            <ApiContext.Provider value={api}>
                                <TheoryLibraryContext.Provider
                                    value={stdTheories}
                                >
                                    <LiveAnalysisContext.Provider
                                        value={() => liveAnalysis()!}
                                    >
                                        <For each={props.annotations}>
                                            {(annotation) => {
                                                console.log(
                                                    "render annotation",
                                                    annotation
                                                );

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
                                                }
                                            }}
                                        </For>
                                    </LiveAnalysisContext.Provider>
                                </TheoryLibraryContext.Provider>
                            </ApiContext.Provider>
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
    patchesToAnnotation: (docBefore, docAfter, patches) => {
        const annotations = patchesToAnnotation<AnalysisDoc>(
            docBefore,
            docAfter,
            patches
        );
        console.log(
            "patchesToAnnotation",
            docBefore,
            docAfter,
            patches,
            annotations
        );

        return annotations;
    },
    AnnotationsView,
};
