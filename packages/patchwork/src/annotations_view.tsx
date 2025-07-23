import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { AnnotationsViewProps } from "@patchwork/sdk";
import { Annotation } from "@patchwork/sdk/versionControl";
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

export const CellAnnotationsView: React.FC<
    AnnotationsViewProps<ModelDoc, Uuid, Cell<unknown>>
> = ({ annotations, doc, handle }) => {
    const solidContainerRef = useRef<HTMLDivElement>(null);
    const solidDisposeRef = useRef<(() => void) | null>(null);
    const repo = useRepo();

    useEffect(() => {
        if (solidContainerRef.current) {
            // Clean up previous render
            if (solidDisposeRef.current) {
                solidDisposeRef.current();
            }

            solidDisposeRef.current = render(
                () =>
                    createComponent(CellAnnotationsViewSolidComponent, {
                        repo,
                        annotations,
                        docUrl: handle.url,
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
    }, [annotations, repo, doc]);

    // We use React.createElement here to avoid bringing in React's JSX transform.
    // We had some trouble with combining both solid and react JSX in one build.
    return React.createElement("div", { ref: solidContainerRef });
};

type CellAnnotationsViewSolidComponentProps = {
    repo: Repo;
    annotations: Annotation<Uuid, Cell<unknown>>[];
    docUrl: AutomergeUrl;
};

export function CellAnnotationsViewSolidComponent(
    props: CellAnnotationsViewSolidComponentProps
) {
    // Typescript gets confused because the patchwork and the frontend package both import "@automerge/automerge-repo" in their package.json
    const api = { repo: props.repo as any };

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
                                                                        annotation.added
                                                                    }
                                                                />
                                                            </div>
                                                        );
                                                    case "deleted":
                                                        return (
                                                            <div class="annotation annotation-deleted">
                                                                <CellView
                                                                    cell={
                                                                        annotation.deleted
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
                                                                            annotation.before
                                                                        }
                                                                    />
                                                                </div>
                                                                <div class="annotation-label">
                                                                    After
                                                                </div>
                                                                <div class="annotation annotation-changed">
                                                                    <CellView
                                                                        cell={
                                                                            annotation.after
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                        );

                                                    case "highlighted":
                                                        return (
                                                            <div class="annotation annotation-highlighted">
                                                                <CellView
                                                                    cell={
                                                                        annotation.value
                                                                    }
                                                                />
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

function CellView<T = unknown>({ cell }: { cell: Cell<T> }) {
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
                    content={(cell as FormalCell<T>).content}
                    changeContent={(_) => {}}
                    isActive={false}
                    actions={{} as CellActions}
                />
            </Match>
        </Switch>
    );
}
