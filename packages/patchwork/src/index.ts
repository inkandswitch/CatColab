import { type Plugin } from "@patchwork/sdk/plugins";

import "./index.css";

export const plugins: Plugin<any>[] = [
    {
        type: "patchwork:dataType",
        id: "catcolab-model",
        name: "CatColab Model",
        icon: "Zap",
        async load() {
            const { dataType } = await import("./datatype");
            return dataType;
        },
    },
    {
        type: "patchwork:dataType",
        id: "catcolab-analysis",
        name: "CatColab Analysis",
        icon: "BarChart3",
        async load() {
            const { dataType } = await import("./analysis-datatype");
            return dataType;
        },
    },
    {
        type: "patchwork:tool",
        id: "catcolab-model",
        name: "CatColab Model",
        icon: "Zap",
        supportedDataTypes: ["catcolab-model"],
        async load() {
            const { Tool } = await import("./modelpanetool");
            const { CellAnnotationsView } = await import(
                "./cellannotationsview"
            );
            return {
                EditorComponent: Tool,
                AnnotationsViewComponent: CellAnnotationsView,
            };
        },
    },
    {
        type: "patchwork:tool",
        id: "catcolab-analysis",
        name: "CatColab Analysis",
        icon: "BarChart3",
        supportedDataTypes: ["catcolab-analysis"],
        async load() {
            const { Tool } = await import("./analysispanetool");
            return { EditorComponent: Tool };
        },
    },
];
