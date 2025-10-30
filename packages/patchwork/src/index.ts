import type { Plugin } from "@patchwork/sdk/plugins";

export const plugins: Plugin<any>[] = [
    {
        type: "patchwork:dataType",
        id: "catcolab-model",
        name: "CatColab Model",
        icon: "Zap",
        async load() {
            const { dataType } = await import("./model_datatype");
            return dataType;
        },
    },
    {
        type: "patchwork:dataType",
        id: "catcolab-analysis",
        name: "CatColab Analysis",
        icon: "BarChart3",
        async load() {
            const { dataType } = await import("./analysis_datatype");
            return dataType;
        },
        unlisted: true,
    },
    {
        type: "patchwork:action",
        id: "catcolab-add-cell",
        name: "Add Cell",
        icon: "Plus",
        supportedDataTypes: ["catcolab-model"],
        async load() {
            return await import("./actions");
        },
    },
    {
        type: "patchwork:action",
        id: "catcolab-change-theory",
        name: "Change Theory",
        icon: "ArrowRightLeft",
        supportedDataTypes: ["catcolab-model"],
        async load() {
            return await import("./change_theory");
        },
    },
    {
        type: "patchwork:action",
        id: "catcolab-rename-cell",
        name: "Rename Cell",
        icon: "Pencil",
        supportedDataTypes: ["catcolab-model"],
        async load() {
            return await import("./rename_cell");
        },
    },
    {
        type: "patchwork:action",
        id: "catcolab-delete-cell",
        name: "Delete Cell",
        icon: "Trash2",
        supportedDataTypes: ["catcolab-model"],
        async load() {
            return await import("./delete_cell");
        },
    },
    {
        type: "patchwork:action",
        id: "catcolab-reorder-cell",
        name: "Reorder Cell",
        icon: "ArrowUpDown",
        supportedDataTypes: ["catcolab-model"],
        async load() {
            return await import("./reorder_cell");
        },
    },
    // {
    //     type: "patchwork:tool",
    //     id: "catcolab-model-view",
    //     name: "Model",
    //     icon: "Zap",
    //     supportedDataTypes: ["catcolab-model"],
    //     async load() {
    //         const { ModelTool } = await import("./tools");

    //         return {
    //             EditorComponent: ModelTool,
    //         };
    //     },
    // },
    // {
    //     type: "patchwork:tool",
    //     id: "catcolab-model-analysis-view",
    //     name: "Analysis",
    //     icon: "Zap",
    //     supportedDataTypes: ["catcolab-model"],
    //     async load() {
    //         const { AnalysisTool } = await import("./tools");

    //         return {
    //             EditorComponent: AnalysisTool,
    //         };
    //     },
    // },
    {
        type: "patchwork:tool",
        id: "catcolab-model-side-by-side-view",
        name: "CatColab",
        icon: "Zap",
        supportedDataTypes: ["catcolab-model"],
        async load() {
            const { SideBySideTool } = await import("./tools");
            return {
                EditorComponent: SideBySideTool,
            };
        },
    },
];
