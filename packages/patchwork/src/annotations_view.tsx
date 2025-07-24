import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { Annotation, AnnotationsViewProps } from "@patchwork/sdk/annotations";
import { Cell, Uuid } from "catlog-wasm";
import React, { useEffect, useRef } from "react";
import {
    createComponent,
    createResource,
    For,
    Match,
    Show,
    Switch,
} from "solid-js";
import { render } from "solid-js/web";
import { ApiContext } from "../../frontend/src/api";
import { LiveModelContext } from "../../frontend/src/model/context";
import { getLiveModel } from "../../frontend/src/model/document";
import { ModelCellEditor } from "../../frontend/src/model/model_editor";
import { CellActions, FormalCell } from "../../frontend/src/notebook";
import { stdTheories, TheoryLibraryContext } from "../../frontend/src/stdlib";
import "./annotations_view.css";
import { ModelDoc } from "./model_datatype";
import { Component } from "solid-js";
import { AnalysisDoc } from "./analysis_datatype";

type CellViewProps = {
    cell: Cell<unknown>;
};

export function ModelAnnotationsView({
    annotations,
    docUrl,
}: AnnotationsViewProps<ModelDoc, Uuid, Cell<unknown>> & {
    CellView: Component<CellViewProps>;
}) {
    return React.createElement(CellAnnotationsView, {
        annotations,
        modelDocUrl: docUrl,
        CellView: ModelCellView,
    });
}

const ModelCellView: Component<CellViewProps> = ({ cell }) => {
    return (
        <Switch>
            <Match when={cell.tag === "rich-text"}>
                Rich text cell
                {/*<RichTextCellEditor
                    cellId={cell.id}
                    handle={
                        props.handle
                    }
                    path={[
                        ...props.path,
                        "cells",
                        i(),
                    ]}
                    isActive={isActive()}
                    actions={
                        cellActions
                    }
                />*/}
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

export function AnalysisAnnotationsView({
    annotations,
    docUrl,
}: AnnotationsViewProps<AnalysisDoc, Uuid, Cell<unknown>> & {
    CellView: Component<CellViewProps>;
}) {
    const [analysisDoc] = useDocument<AnalysisDoc>(docUrl);

    const modelDocUrl = analysisDoc?.analysisOf?._id;
    if (!modelDocUrl) {
        return null;
    }

    return React.createElement(CellAnnotationsView, {
        annotations,
        modelDocUrl,
        CellView: AnalysisCellView,
    });
}

const AnalysisCellView: Component<CellViewProps> = ({ cell }) => {
    return <div>Analysis cell</div>;
};

export function CellAnnotationsView({
    annotations,
    modelDocUrl,
    CellView,
}: {
    annotations: Annotation<ModelDoc | AnalysisDoc, Uuid, Cell<unknown>>[];
    modelDocUrl: AutomergeUrl;
    CellView: Component<CellViewProps>;
}) {
    const solidContainerRef = useRef<HTMLDivElement>(null);
    const solidDisposeRef = useRef<(() => void) | null>(null);
    const repo = useRepo();
    const modelHandle = useDocument<ModelDoc>(modelDocUrl);

    useEffect(() => {
        if (solidContainerRef.current && modelHandle) {
            // Clean up previous render
            if (solidDisposeRef.current) {
                solidDisposeRef.current();
            }

            solidDisposeRef.current = render(
                () =>
                    createComponent(CellAnnotationsViewSolid, {
                        repo,
                        annotations,
                        modelDocUrl,
                        CellView,
                    }),
                solidContainerRef.current
            );
        }

        // Cleanup on unmount
        return () => {
            if (solidDisposeRef.current) {
                solidDisposeRef.current();
                solidDisposeRef.current = null;
            }
        };
    }, [annotations, repo]);

    // We use React.createElement here to avoid bringing in React's JSX transform.
    // We had some trouble with combining both solid and react JSX in one build.
    return React.createElement("div", { ref: solidContainerRef });
}

type CellAnnotationsViewSolidComponentProps = {
    repo: Repo;
    annotations: Annotation<ModelDoc | AnalysisDoc, Uuid, Cell<unknown>>[];
    modelDocUrl: AutomergeUrl;
    CellView: Component<{ cell: Cell<unknown> }>;
};

function CellAnnotationsViewSolid(
    props: CellAnnotationsViewSolidComponentProps
) {
    const CellView = props.CellView;

    // Typescript gets confused because the patchwork and the frontend package both import "@automerge/automerge-repo" in their package.json
    const api = { repo: props.repo as any };

    const [liveModel] = createResource(
        () => props.modelDocUrl,
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
                                                }
                                            }}
                                        </For>
                                    </LiveModelContext.Provider>
                                </TheoryLibraryContext.Provider>
                            </ApiContext.Provider>
                        );
                    }}
                </Show>
            </div>
        </div>
    );
}
