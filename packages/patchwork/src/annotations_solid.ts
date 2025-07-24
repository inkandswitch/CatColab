import { Accessor, createContext, useContext } from "solid-js";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import type { Annotation } from "@patchwork/sdk/annotations";

export type DocUrlWithAnnotations = {
    originalUrl: AutomergeUrl;
    cloneUrl: AutomergeUrl;
    annotations: Annotation[];
};

export const AnnotationsContext = createContext<
    Accessor<DocUrlWithAnnotations[]>
>(() => []);

export const useAnnotationsOfDoc = <D, T, V>(
    docUrl: AutomergeUrl
): Annotation<D, T, V>[] => {
    const context = useContext(AnnotationsContext);
    if (!context) {
        return [];
    }

    const docWithAnnotations = context().find(
        (item) => item.cloneUrl === docUrl || item.originalUrl === docUrl
    );

    return (docWithAnnotations?.annotations ?? []) as Annotation<D, T, V>[];
};
