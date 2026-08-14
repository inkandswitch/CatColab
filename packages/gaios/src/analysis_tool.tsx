import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { createResource, Match, onCleanup, onMount, Switch } from "solid-js";
import { render } from "solid-js/web";

import {
    getLiveAnalysisFromRepo,
    type LiveAnalysisDoc,
    type LiveModelAnalysisDoc,
} from "../../frontend/src/analysis";
import { AnalysisNotebookEditor } from "../../frontend/src/analysis/analysis_editor";
import {
    createModelLibraryWithRepo,
    type ModelLibrary,
    ModelLibraryContext,
} from "../../frontend/src/model";
import { ModelNotebookEditor } from "../../frontend/src/model/model_editor";
import { ModelDocumentHead } from "../../frontend/src/model/model_info";
import { DocumentHead } from "../../frontend/src/page/document_head";
import { stdTheories } from "../../frontend/src/stdlib";
import { TheoryLibraryContext } from "../../frontend/src/theory";
import { rootFocus, useChildFocus } from "../../ui-components/src/util/focus";
import type { AnalysisDoc } from "./analysis_datatype";
import { createNotebookDiff } from "./notebook_diff";

import "../../ui-components/src/global.css";

type ToolElement = HTMLElement & { repo: Repo };

/** Patchwork tool that shows a CatColab analysis side by side with its model.

The tool's document is the analysis; the model is resolved through the
analysis's `analysisOf` reference and rendered in the left pane, with the
analysis notebook in the right pane. Both panes are live and editable.
 */
export function renderAnalysisTool(handle: DocHandle<AnalysisDoc>, element: ToolElement) {
    return render(() => <AnalysisTool handle={handle} element={element} />, element);
}

export function AnalysisTool(props: { handle: DocHandle<AnalysisDoc>; element: ToolElement }) {
    // oxlint-disable-next-line solid/reactivity -- the host element and its repo are fixed for the tool's lifetime
    const modelLibrary = createModelLibraryWithRepo(props.element.repo, stdTheories);

    const [liveAnalysis] = createResource(
        () => props.handle.url,
        // oxlint-disable-next-line solid/reactivity -- the host element and its repo are fixed for the tool's lifetime
        (docUrl) => getLiveAnalysisFromRepo(docUrl, props.element.repo, modelLibrary),
    );

    return (
        <Switch>
            <Match when={liveAnalysis.loading}>
                <div style={messageStyle}>⏳ Loading analysis...</div>
            </Match>
            <Match when={liveAnalysis.error}>
                <div style={messageStyle}>
                    ❌ Error loading analysis: {liveAnalysis.error?.message || "Unknown error"}
                </div>
            </Match>
            <Match when={liveAnalysis()}>
                {(liveAnalysis) => (
                    <Switch
                        fallback={
                            <div style={messageStyle}>
                                Only analyses of models can be shown in Patchwork.
                            </div>
                        }
                    >
                        <Match when={asModelAnalysis(liveAnalysis())}>
                            {(modelAnalysis) => (
                                <TheoryLibraryContext.Provider value={stdTheories}>
                                    <ModelLibraryContext.Provider
                                        value={modelLibrary as ModelLibrary<string>}
                                    >
                                        <ModelAnalysisPanes
                                            modelAnalysis={modelAnalysis()}
                                            element={props.element}
                                        />
                                    </ModelLibraryContext.Provider>
                                </TheoryLibraryContext.Provider>
                            )}
                        </Match>
                    </Switch>
                )}
            </Match>
        </Switch>
    );
}

/** The side-by-side model and analysis panes.

Each pane subscribes to Patchwork's diff baseline for its own document and
renders its notebook with diff highlights whenever a baseline is active (e.g.
a draft's diff overlay is turned on). Without a baseline, both panes render
as plain editors.
 */
function ModelAnalysisPanes(props: { modelAnalysis: LiveModelAnalysisDoc; element: ToolElement }) {
    const { childFocus } = useChildFocus<"model" | "analysis">(rootFocus, { default: "model" });

    // oxlint-disable solid/reactivity -- the host element and the doc handles are fixed for the tool's lifetime
    const modelHandle = props.modelAnalysis.liveModel.liveDoc.docHandle;
    const analysisHandle = props.modelAnalysis.liveDoc.docHandle;

    const modelDiff = createNotebookDiff(props.element, modelHandle);
    const analysisDiff = createNotebookDiff(props.element, analysisHandle);

    // The host announces only the document the tool was opened with; the other
    // document of the pair is resolved by the tool itself. Announce both so
    // Patchwork's draft system counts both as draft members; otherwise the
    // unannounced one stays live while the history scrubber pins the rest.
    announceDocMounted(props.element, modelHandle.url, "catcolab-model");
    announceDocMounted(props.element, analysisHandle.url, "catcolab-analysis");
    // oxlint-enable solid/reactivity

    return (
        <div style={{ display: "flex", height: "100%" }}>
            <div
                style={{
                    ...paneStyle,
                    "border-right": "1px solid rgba(0, 0, 0, 0.15)",
                }}
            >
                <ModelDocumentHead liveModel={props.modelAnalysis.liveModel} />
                <ModelNotebookEditor
                    liveModel={props.modelAnalysis.liveModel}
                    focus={childFocus("model")}
                    diff={modelDiff()}
                />
            </div>
            <div style={paneStyle}>
                <DocumentHead liveDoc={props.modelAnalysis.liveDoc} />
                <AnalysisNotebookEditor
                    liveAnalysis={props.modelAnalysis}
                    focus={childFocus("analysis")}
                    diff={analysisDiff()}
                />
            </div>
        </div>
    );
}

/** Report a document as mounted to Patchwork for this component's lifetime.

Mirrors the `patchwork:mounted` / `patchwork:unmounted` events that the host's
own document view dispatches. Patchwork's draft system counts announced
documents as draft members, which is what makes its history scrubber pin them
to checkpoint heads (applied in place through `element.repo`'s overlay
handles).
 */
function announceDocMounted(element: HTMLElement, url: AutomergeUrl, toolId: string) {
    const detail = { url, toolId };
    onMount(() => {
        element.dispatchEvent(
            new CustomEvent("patchwork:mounted", { detail, bubbles: true, composed: true }),
        );
        onCleanup(() => {
            element.dispatchEvent(
                new CustomEvent("patchwork:unmounted", { detail, bubbles: true, composed: true }),
            );
        });
    });
}

function asModelAnalysis(liveAnalysis: LiveAnalysisDoc): LiveModelAnalysisDoc | undefined {
    return liveAnalysis.analysisType === "model" ? liveAnalysis : undefined;
}

const paneStyle = {
    flex: "1",
    "min-width": "0",
    overflow: "auto",
    padding: "52px 28px 28px",
};

const messageStyle = { padding: "52px" };
