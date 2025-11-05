// re-export the standard library from the frontend
// this is here as a vite export target; we could just use a path export
// from elsewhere in the project but this is a more explicit way to do it

import * as frontendStdlib from "../../frontend/src/stdlib";
import { stdTheories } from "../../frontend/src/stdlib";
import addCellAction, {
    addCells as addCellsAction,
    makeTheoriesCache,
} from "./add_cell_for_worker";

/*
import changeTheoryAction, {
    argsSchema as changeTheoryArgsSchema,
} from "./change_theory";
import renameCellAction, {
    argsSchema as renameCellArgsSchema,
} from "./rename_cell";
import deleteCellAction, {
    argsSchema as deleteCellArgsSchema,
} from "./delete_cell";
import reorderCellAction, {
    argsSchema as reorderCellArgsSchema,
} from "./reorder_cell";
*/

const patchworkActions = {
    addCell: addCellAction,
    addCells: addCellsAction,
};
/*
    changeTheory: changeTheoryAction,
    changeTheoryArgsSchema,
    renameCell: renameCellAction,
    renameCellArgsSchema,
    deleteCell: deleteCellAction,
    deleteCellArgsSchema,
    reorderCell: reorderCellAction,
    reorderCellArgsSchema,
};
*/

type FakeElement = {
    tagName: string;
    textContent: string;
    id?: string;
    rel?: string;
    as?: string;
    href?: string;
    crossOrigin?: string;
    setAttribute(name: string, value: string): void;
    getAttribute(name: string): string | undefined;
    addEventListener(event: string, handler: () => void): void;
    removeEventListener(event: string, handler: () => void): void;
    remove(): void;
    dispatchEvent(event: string): void;
    appendChild?(node: FakeElement): FakeElement;
    removeChild?(node: FakeElement): void;
};

type ShimDocument = {
    __patchworkStdlibShim: true;
    head: FakeElement;
    createElement(tag: string): FakeElement;
    querySelector(selector: string): FakeElement | null;
    getElementsByTagName(tag: string): FakeElement[];
};

type ShimTarget = {
    document?: ShimDocument;
    window?: unknown;
    HTMLElement?: new (...args: Array<unknown>) => unknown;
};

/**
 * Installs a minimal DOM shim so Vite's CSS runtime can execute inside a worker.
 * The shim is intentionally small: it only implements the surface that the
 * generated CSS loader and module-preload helper touch (appendChild on <head>,
 * createElement for <style>/<link>, simple selectors via querySelector, and
 * getElementsByTagName lookups).
 */
export function installStdlibWorkerShim(
    target: ShimTarget = globalThis as unknown as ShimTarget
) {
    const shimTarget = target as ShimTarget;
    const existingDocument = shimTarget.document;
    if (existingDocument) {
        if (existingDocument.__patchworkStdlibShim) {
            return;
        }

        // A real document is already present; nothing to do.
        return;
    }

    const elementsByTag = new Map<string, Set<FakeElement>>();
    const styleNodesById = new Map<string, FakeElement>();

    const registerElement = (element: FakeElement) => {
        const tag = element.tagName;
        let set = elementsByTag.get(tag);
        if (!set) {
            set = new Set();
            elementsByTag.set(tag, set);
        }
        set.add(element);
        if (tag === "style" && element.id) {
            styleNodesById.set(element.id, element);
        }
    };

    const unregisterElement = (element: FakeElement) => {
        const tag = element.tagName;
        const set = elementsByTag.get(tag);
        if (set) {
            set.delete(element);
            if (set.size === 0) {
                elementsByTag.delete(tag);
            }
        }
        if (tag === "style" && element.id) {
            styleNodesById.delete(element.id);
        }
    };

    const createFakeElement = (tag: string): FakeElement => {
        const normalized = tag.toLowerCase();
        const attributes = new Map<string, string>();
        const listeners = new Map<string, Set<() => void>>();
        let removed = false;
        let idValue: string | undefined;
        let relValue: string | undefined;
        let asValue: string | undefined;
        let hrefValue: string | undefined;
        let crossOriginValue: string | undefined;

        function updateId(value: string | undefined) {
            if (idValue === value) {
                return;
            }
            if (normalized === "style" && idValue) {
                styleNodesById.delete(idValue);
            }
            idValue = value;
            if (value === undefined) {
                attributes.delete("id");
            } else {
                attributes.set("id", value);
                if (normalized === "style") {
                    styleNodesById.set(value, element);
                }
            }
        }

        const element: FakeElement = {
            tagName: normalized,
            textContent: "",
            setAttribute(name: string, value: string) {
                const lower = name.toLowerCase();
                attributes.set(lower, value);
                switch (lower) {
                    case "data-vite-dev-id":
                    case "id":
                        updateId(value);
                        break;
                    case "rel":
                        relValue = value;
                        break;
                    case "as":
                        asValue = value;
                        break;
                    case "href":
                        hrefValue = value;
                        break;
                    case "crossorigin":
                        crossOriginValue = value;
                        break;
                    case "nonce":
                        (element as Record<string, unknown>).nonce = value;
                        break;
                    default:
                        break;
                }
            },
            getAttribute(name: string) {
                return attributes.get(name.toLowerCase());
            },
            addEventListener(event: string, handler: () => void) {
                let set = listeners.get(event);
                if (!set) {
                    set = new Set();
                    listeners.set(event, set);
                }
                set.add(handler);
            },
            removeEventListener(event: string, handler: () => void) {
                const set = listeners.get(event);
                if (!set) {
                    return;
                }
                set.delete(handler);
                if (set.size === 0) {
                    listeners.delete(event);
                }
            },
            remove() {
                if (removed) {
                    return;
                }
                removed = true;
                unregisterElement(element);
            },
            dispatchEvent(event: string) {
                const set = listeners.get(event);
                if (!set) {
                    return;
                }
                for (const handler of Array.from(set)) {
                    try {
                        handler();
                    } catch (err) {
                        console.error(err);
                    }
                }
            },
        };

        Object.defineProperties(element, {
            id: {
                get() {
                    return idValue;
                },
                set(value: string | undefined) {
                    updateId(value);
                },
                enumerable: true,
                configurable: true,
            },
            rel: {
                get() {
                    return relValue;
                },
                set(value: string | undefined) {
                    relValue = value;
                    if (value === undefined) {
                        attributes.delete("rel");
                    } else {
                        attributes.set("rel", value);
                    }
                },
                enumerable: true,
                configurable: true,
            },
            as: {
                get() {
                    return asValue;
                },
                set(value: string | undefined) {
                    asValue = value;
                    if (value === undefined) {
                        attributes.delete("as");
                    } else {
                        attributes.set("as", value);
                    }
                },
                enumerable: true,
                configurable: true,
            },
            href: {
                get() {
                    return hrefValue;
                },
                set(value: string | undefined) {
                    hrefValue = value;
                    if (value === undefined) {
                        attributes.delete("href");
                    } else {
                        attributes.set("href", value);
                    }
                },
                enumerable: true,
                configurable: true,
            },
            crossOrigin: {
                get() {
                    return crossOriginValue;
                },
                set(value: string | undefined) {
                    crossOriginValue = value;
                    if (value === undefined) {
                        attributes.delete("crossorigin");
                    } else {
                        attributes.set("crossorigin", value);
                    }
                },
                enumerable: true,
                configurable: true,
            },
        });

        return element;
    };

    const fakeHead = createFakeElement("head");
    fakeHead.remove = () => {
        // The head element is never removed in this shim.
    };
    fakeHead.appendChild = (node: FakeElement) => {
        registerElement(node);
        if (node.tagName === "link") {
            queueMicrotask(() => {
                node.dispatchEvent("load");
            });
        }
        return node;
    };
    fakeHead.removeChild = (node: FakeElement) => {
        node.remove();
    };
    registerElement(fakeHead);

    const fakeDocument: ShimDocument = {
        __patchworkStdlibShim: true,
        head: fakeHead,
        createElement(tag: string): FakeElement {
            const normalized = tag.toLowerCase();
            if (normalized !== "style" && normalized !== "link") {
                throw new Error(
                    `Worker shim only supports creating <style> or <link>; requested <${tag}>`
                );
            }
            return createFakeElement(normalized);
        },
        querySelector(selector: string): FakeElement | null {
            const dataMatch = selector.match(/\[data-vite-dev-id="([^"]+)"\]/);
            if (dataMatch) {
                return styleNodesById.get(dataMatch[1]) ?? null;
            }
            const linkMatch = selector.match(
                /^link\[href="([^"]+)"\](?:\[rel="([^"]+)"\])?$/
            );
            if (linkMatch) {
                const [, href, rel] = linkMatch;
                const links = elementsByTag.get("link");
                if (!links) {
                    return null;
                }
                for (const link of links) {
                    if (link.href === href && (!rel || link.rel === rel)) {
                        return link;
                    }
                }
                return null;
            }
            return null;
        },
        getElementsByTagName(tag: string): FakeElement[] {
            const normalized = tag.toLowerCase();
            if (normalized === "head") {
                return [fakeHead];
            }
            const set = elementsByTag.get(normalized);
            return set ? Array.from(set) : [];
        },
    };

    shimTarget.document = fakeDocument;
    if (!shimTarget.window) {
        shimTarget.window = target as unknown;
    }
    if (!shimTarget.HTMLElement) {
        shimTarget.HTMLElement = function HTMLElementShim() {
            // Intentionally empty.
        } as unknown as ShimTarget["HTMLElement"];
    }
}

export const actions = patchworkActions;

export const workerStdlib = {
    ...frontendStdlib,
    actions: patchworkActions,
};

export * as stdlib from "../../frontend/src/stdlib";

console.log("Installing stdlib worker shim");
await installStdlibWorkerShim();
console.log("Making theories cache");
await makeTheoriesCache(stdTheories);
console.log("Theories cache made, ready to go");
