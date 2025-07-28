import { Accessor, createContext, useContext } from "solid-js";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import type {
    Annotation,
    AnnotationWithUIState,
    DocLinkWithAnnotations,
    Pointer,
} from "@patchwork/sdk/annotations";

export type DocUrlWithAnnotations = {
    originalUrl: AutomergeUrl;
    cloneUrl: AutomergeUrl;
    annotations: Annotation[];
};

export const AnnotationsContext = createContext<
    Accessor<{
        docLinksWithAnnotations: DocLinkWithAnnotations[];
        setSelection: (docUrl: AutomergeUrl, pointers: Pointer[]) => void;
    }>
>();

export const useAnnotationsOfDoc = <D, T, V>(
    docUrl: AutomergeUrl
): {
    annotations: Accessor<AnnotationWithUIState<D, T, V>[]>;
    setSelection: (pointers: Pointer<D, T, V>[]) => void;
} => {
    const context = useContext(AnnotationsContext);
    if (!context) {
        throw new Error("AnnotationsContext not found");
    }

    const annotations = () => {
        return (context().docLinksWithAnnotations.find(
            (docLinkWithAnnotations) =>
                docLinkWithAnnotations.url === docUrl ||
                docLinkWithAnnotations.main?.url === docUrl
        )?.annotations ?? []) as AnnotationWithUIState<D, T, V>[];
    };

    return {
        annotations,
        setSelection: (pointers: Pointer<D, T, V>[]) => {
            context().setSelection(docUrl, pointers);
        },
    };
};
