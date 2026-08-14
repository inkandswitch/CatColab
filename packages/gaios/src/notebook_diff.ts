import { type Doc, view } from "@automerge/automerge";
import { decodeHeads, type DocHandle, type UrlHeads } from "@automerge/automerge-repo";
import { subscribe } from "@inkandswitch/patchwork-providers-solid";
import { type Accessor, createMemo, createSignal, onCleanup } from "solid-js";

import type { Notebook } from "catcolab-document-types";
import { diffNotebooks, type NotebookDiff } from "../../frontend/src/notebook";

/** Any document that carries a notebook, e.g. a model or analysis document. */
type NotebookDoc<T> = { notebook: Notebook<T> };

/** Diff baseline served by Patchwork's draft overlay (`draft:baseline`).

`heads` is `null` when there is no baseline — e.g. no draft is checked out or
its diff overlay is off — in which case no diff is rendered.
 */
type Baseline = { heads: UrlHeads | null };

/** Reactive notebook diff for a document hosted in Patchwork.

Subscribes to Patchwork's `draft:baseline` provider for the document and, when
a baseline is set, compares the live notebook against the notebook as of the
baseline heads. Reads `undefined` while there is no baseline, so the notebook
editors render without any diff decorations.
 */
export function createNotebookDiff<T>(
    element: HTMLElement,
    handle: DocHandle<NotebookDoc<T>>,
): Accessor<NotebookDiff<T> | undefined> {
    const baseline = subscribe<Baseline>(
        element,
        { type: "draft:baseline", url: handle.url },
        { heads: null },
    );

    // Document changes don't feed Solid's graph on their own, so count them
    // into a signal for the memo below to track.
    const [docVersion, setDocVersion] = createSignal(0);
    const onChange = () => setDocVersion((version) => version + 1);
    handle.on("change", onChange);
    onCleanup(() => handle.off("change", onChange));

    return createMemo(() => {
        docVersion();
        const heads = baseline()?.heads;
        if (!heads) {
            return undefined;
        }
        return diffNotebookAtHeads(handle.doc(), heads);
    });
}

function diffNotebookAtHeads<T>(doc: Doc<NotebookDoc<T>>, heads: UrlHeads): NotebookDiff<T> {
    const before = view(doc, decodeHeads(heads));
    return diffNotebooks(plainNotebook(before), plainNotebook(doc));
}

/** Deep-copy a document's notebook to plain JS, shedding Automerge proxies. */
function plainNotebook<T>(doc: NotebookDoc<T>): Notebook<T> {
    const notebook = doc.notebook ?? { cellOrder: [], cellContents: {} };
    return JSON.parse(JSON.stringify(notebook)) as Notebook<T>;
}
