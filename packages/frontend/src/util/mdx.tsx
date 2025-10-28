import type { MDXProps } from "mdx/types";
import { type Component, lazy } from "solid-js";

// @ts-ignore - MDX type mismatch
export function lazyMdx(fn: () => Promise<{ default: Component<MDXProps> }>) {
    // @ts-ignore
    const MDXPage = lazy(fn);
    return () => <MDXPage />;
}
