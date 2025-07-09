import React, { useEffect, useRef } from "react";
import {
    createComponent,
    createResource,
    For,
    Match,
    onMount,
    Show,
    Switch,
} from "solid-js";
import { getLiveModel } from "../../frontend/src/model/document";
import { stdTheories, TheoryLibraryContext } from "../../frontend/src/stdlib";
import { AnnotationsViewProps } from "@patchwork/sdk";
import { Doc } from "./datatype";
import { Cell, Uuid } from "catlog-wasm";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { Annotation } from "@patchwork/sdk/versionControl";
import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { ApiContext } from "../../frontend/src/api";
import { render } from "solid-js/web";
import { ModelCellEditor } from "../../frontend/src/model/model_editor";
import {
    CellActions,
    FormalCell,
    RichTextCellEditor,
} from "../../frontend/src/notebook";
import { LiveModelContext } from "../../frontend/src/model/context";
import "./cellannotationsview.css";

export const CellAnnotationsView: React.FC<
    AnnotationsViewProps<Doc, Uuid, Cell<unknown>>
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
                    {(_) => {
                        console.log("liveModel", liveModel());

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
                                                            <div class="annotation-added">
                                                                <CellView
                                                                    cell={
                                                                        annotation.added
                                                                    }
                                                                />
                                                            </div>
                                                        );
                                                    case "deleted":
                                                        return (
                                                            <div class="annotation-deleted">
                                                                <CellView
                                                                    cell={
                                                                        annotation.deleted
                                                                    }
                                                                />
                                                            </div>
                                                        );
                                                    case "changed":
                                                        return (
                                                            <div class="annotation">
                                                                <div class="annotation-label">
                                                                    Before
                                                                </div>
                                                                <CellView
                                                                    cell={
                                                                        annotation.before
                                                                    }
                                                                />
                                                                <div class="annotation-label">
                                                                    After
                                                                </div>
                                                                <div class="annotation-changed">
                                                                    <CellView
                                                                        cell={
                                                                            annotation.after
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
