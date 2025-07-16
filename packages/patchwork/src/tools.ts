import {
    useDocHandle,
    useDocument,
    useRepo,
} from "@automerge/automerge-repo-react-hooks";
import { DocPath, EditorProps } from "@patchwork/sdk";
import { ModelDoc } from "./model_datatype";
import React, { useRef, useEffect, useMemo } from "react";
import { createComponent, render } from "solid-js/web";
import { ModelPaneComponent } from "./model_pane.solid";
import { Annotation } from "@patchwork/sdk/versionControl";
import { Cell, Uuid } from "catlog-wasm";
import { createSignal } from "../../frontend/node_modules/.pnpm/solid-js@1.9.2/node_modules/solid-js";
import { useStaticCallback } from "@patchwork/sdk/hooks";
import { Repo } from "@automerge/automerge-repo";
import { JSX } from "solid-js";
import { AnalysisPaneComponent } from "./analysis_pane.solid";
import {
    init as initAnalysis,
    AnalysisDoc as AnalysisDoc,
} from "./analysis_datatype";
import "./tools.css";
import { useBranchScopeAndActiveBranchInfo } from "@patchwork/sdk/versionControl";

export type SolidToolProps = {
    docUrl: string;
    repo: Repo;
    annotations: () => Annotation<Uuid, Cell<unknown>>[];
    onAddComment: (cellId: Uuid) => void;
};

export const ModelTool: React.FC<EditorProps<Uuid, Cell<unknown>>> = ({
    docUrl,
    docPath,
    annotations,
    setCommentState,
}) => {
    return React.createElement(Tool, {
        docUrl,
        docPath,
        annotations,
        setCommentState,
        solidComponent: ModelPaneComponent,
    });
};

export const AnalysisTool: React.FC<EditorProps<Uuid, Cell<unknown>>> = ({
    docUrl,
    docPath,
}) => {
    const modelDocHandle = useDocHandle<ModelDoc>(docUrl, { suspense: true });
    const [modelDoc] = useDocument<ModelDoc>(docUrl, { suspense: true });
    const repo = useRepo();

    const analysisDocPath = useMemo<DocPath | undefined>(
        () =>
            modelDoc.analysisDocUrl
                ? [
                      ...docPath,
                      {
                          name: "analysis",
                          type: "analysis",
                          url: modelDoc.analysisDocUrl,
                      },
                  ]
                : undefined,
        [docPath, modelDoc]
    );

    const branchState = useBranchScopeAndActiveBranchInfo(analysisDocPath);
    const branchScopeAndActiveBranchInfo =
        branchState.status === "ready" ? branchState.data : undefined;
    const analysisDocUrl = !branchScopeAndActiveBranchInfo
        ? modelDoc.analysisDocUrl
        : branchScopeAndActiveBranchInfo?.cloneOrMainOm?.url;

    // we can't create the analysis document in the init funciton of the model document because
    // the analysis needs a reference to the model document, and the model document doesn't exist at that point
    useEffect(() => {
        if (modelDoc.analysisDocUrl) {
            return;
        }
        const analysisDocHandle = repo.create<AnalysisDoc>();

        analysisDocHandle.change((doc) => {
            initAnalysis(doc);
            doc.analysisOf = {
                _id: docUrl,
            };
            doc.analysisType = "model";
        });

        modelDocHandle.change((doc) => {
            doc.analysisDocUrl = analysisDocHandle.url;
        });
    }, [modelDoc.analysisDocUrl, modelDocHandle]);

    if (!analysisDocUrl) {
        return null;
    }

    return React.createElement(Tool, {
        docUrl: analysisDocUrl,
        docPath,
        annotations: [],
        setCommentState: () => {},
        solidComponent: AnalysisPaneComponent,
    });
};

export const SideBySideTool: React.FC<EditorProps<Uuid, Cell<unknown>>> = (
    props
) => {
    return React.createElement("div", { className: "split-view-container" }, [
        React.createElement("div", { className: "split-view-pane" }, [
            React.createElement(ModelTool, props),
        ]),
        React.createElement("div", { className: "split-view-divider" }),
        React.createElement("div", { className: "split-view-pane" }, [
            React.createElement("h1", {}, "Analysis"),
            React.createElement(AnalysisTool, props),
        ]),
    ]);
};

const Tool: React.FC<
    EditorProps<Uuid, Cell<unknown>> & {
        solidComponent?: (props: SolidToolProps) => JSX.Element;
    }
> = ({
    docUrl,
    docPath,
    annotations,
    setCommentState,
    solidComponent = ModelPaneComponent,
}) => {
    const handle = useDocHandle<ModelDoc>(docUrl, { suspense: true });
    const repo = useRepo();

    const solidContainerRef = useRef<HTMLDivElement>(null);
    const solidDisposeRef = useRef<(() => void) | null>(null);

    const [getAnnotations, setAnnotations] = useMemo(
        () => createSignal<Annotation<Uuid, Cell<unknown>>[]>([]),
        []
    );

    const onAddComment = useStaticCallback((cellId: Uuid) => {
        console.log("add comment", cellId, setCommentState);

        setCommentState?.({
            type: "create",
            target: [cellId],
        });
    });

    useEffect(() => {
        if (!handle || !repo) {
            return;
        }

        console.log("remount", docUrl);

        if (solidContainerRef.current) {
            // Clean up previous render
            if (solidDisposeRef.current) {
                solidDisposeRef.current();
            }

            solidDisposeRef.current = render(
                () =>
                    createComponent(solidComponent, {
                        docUrl,
                        repo,
                        annotations: getAnnotations,
                        onAddComment,
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
    }, [docUrl, handle, solidComponent]);

    useEffect(() => {
        setAnnotations(annotations || []);
    }, [annotations]);

    if (!handle) {
        return null;
    }

    // We use React.createElement here to avoid bringing in React's JSX transform.
    // We had some trouble with combining both solid and react JSX in one build.
    return React.createElement("div", { ref: solidContainerRef });
};
