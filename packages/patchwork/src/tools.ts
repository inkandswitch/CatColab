import { Repo } from "@automerge/automerge-repo";
import {
    useDocHandle,
    useDocument,
    useRepo,
} from "@automerge/automerge-repo-react-hooks";
import { EditorProps } from "@patchwork/sdk";
import { useAllAnnotations } from "@patchwork/sdk/annotations";
import { Cell, Uuid } from "catlog-wasm";
import React, { useEffect, useMemo, useRef } from "react";
import { Accessor, JSX, createSignal } from "solid-js";

import { createComponent, render } from "solid-js/web";
import { AnalysisDoc } from "./analysis_datatype";
import { AnalysisPaneComponent } from "./analysis_pane";
import { ModelDoc } from "./model_datatype";
import { ModelPaneComponent } from "./model_pane";
import "./tools.css";

export type SolidToolProps = {
    docUrl: string;
    repo: Repo;
    annotationsContextValue: Accessor<ReturnType<typeof useAllAnnotations>>;
};

export const ModelTool: React.FC<EditorProps<Uuid, Cell<unknown>>> = ({
    docUrl,
}) => {
    return React.createElement(Tool, {
        docUrl,
        solidComponent: ModelPaneComponent,
    });
};

export const AnalysisTool: React.FC<EditorProps<Uuid, Cell<unknown>>> = ({
    docUrl,
}) => {
    const [modelDoc] = useDocument<ModelDoc>(docUrl, { suspense: true });

    const docUrlsWithAnnotations = useAllAnnotations();

    const analysisDocUrl = modelDoc.analysisDocUrl;

    const resolvedAnalysisDocUrl = useMemo(
        () =>
            docUrlsWithAnnotations.find((a) => a.main?.url === analysisDocUrl)
                ?.url ?? analysisDocUrl,
        [modelDoc.analysisDocUrl, docUrlsWithAnnotations]
    );

    const resolvedModelDocUrl = useMemo(() => {
        const annotation = docUrlsWithAnnotations.find((a) => a.url === docUrl);
        return annotation?.main?.url ?? docUrl;
    }, [docUrl, docUrlsWithAnnotations]);

    const analysisDocHandle = useDocHandle<AnalysisDoc>(
        resolvedAnalysisDocUrl,
        { suspense: true }
    );

    // hack: update the analysis document to point to the current model document
    //
    // Why do we need to do this?
    //
    // when we create a branch of a model document this creates a copy of the analysis document
    // so both documents are branched together
    //
    // the problem is that the forked analysis document still points to the original model document
    // the correct solution would be to resolve the url to point to the forked model document
    // but that would involve pushing the resolve logic down into the frontend package
    // since the whole branch scope resolution is very hacky right now I want to avoid that
    useEffect(() => {
        if (
            !modelDoc ||
            !analysisDocHandle ||
            analysisDocHandle.doc()?.analysisOf?._id === resolvedModelDocUrl
        ) {
            return;
        }
        analysisDocHandle.change((doc) => {
            doc.analysisOf = {
                _id: resolvedModelDocUrl,
            };
        });
    }, [resolvedAnalysisDocUrl, modelDoc, analysisDocHandle]);

    if (!resolvedAnalysisDocUrl) {
        return null;
    }

    return React.createElement(Tool, {
        docUrl: resolvedAnalysisDocUrl,
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
> = ({ docUrl, solidComponent = ModelPaneComponent }) => {
    const handle = useDocHandle<ModelDoc>(docUrl, { suspense: true });
    const repo = useRepo();

    const allAnnotations = useAllAnnotations();

    const solidContainerRef = useRef<HTMLDivElement>(null);
    const solidDisposeRef = useRef<(() => void) | null>(null);

    const [getAnnotationsContextValue, setAnnotationsContextValue] = useMemo(
        () => createSignal<ReturnType<typeof useAllAnnotations>>([]),
        []
    );

    useEffect(() => {
        if (!handle || !repo) {
            return;
        }

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
                        annotationsContextValue: getAnnotationsContextValue,
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
        setAnnotationsContextValue(allAnnotations || []);
    }, [allAnnotations]);

    if (!handle) {
        return null;
    }

    // We use React.createElement here to avoid bringing in React's JSX transform.
    // We had some trouble with combining both solid and react JSX in one build.
    return React.createElement("div", { ref: solidContainerRef });
};
