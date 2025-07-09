import { useDocHandle, useRepo } from "@automerge/automerge-repo-react-hooks";
import { EditorProps } from "@patchwork/sdk";
import { Doc } from "./datatype";
import React, { useRef, useEffect, useMemo } from "react";
import { createComponent, render } from "solid-js/web";
import { ModelPaneComponent } from "./modelpane.solid";
import { Annotation } from "@patchwork/sdk/versionControl";
import { Cell, Uuid } from "catlog-wasm";
import { createSignal } from "../../frontend/node_modules/.pnpm/solid-js@1.9.2/node_modules/solid-js";

export const Tool: React.FC<EditorProps<Uuid, Cell<unknown>>> = ({
    docUrl,
    annotations,
}) => {
    const handle = useDocHandle<Doc>(docUrl, { suspense: true });
    const repo = useRepo();

    const solidContainerRef = useRef<HTMLDivElement>(null);
    const solidDisposeRef = useRef<(() => void) | null>(null);

    const [getAnnotations, setAnnotations] = useMemo(
        () => createSignal<Annotation<Uuid, Cell<unknown>>[]>([]),
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
                    createComponent(ModelPaneComponent, {
                        docUrl,
                        repo,
                        annotations: getAnnotations,
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
    }, [docUrl, handle]);

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
