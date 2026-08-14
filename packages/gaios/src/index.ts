export const plugins = [
    {
        type: "patchwork:datatype",
        id: "catcolab-model",
        name: "CatColab Model",
        icon: "Zap",
        async load() {
            const { dataType } = await import("./model_datatype");
            return dataType;
        },
    },
    {
        type: "patchwork:tool",
        id: "catcolab-model",
        name: "CatColab",
        icon: "Zap",
        supportedDatatypes: ["catcolab-model"],
        async load() {
            const { renderModelTool } = await import("./model_tool");
            return renderModelTool;
        },
    },
    {
        type: "patchwork:datatype",
        id: "catcolab-analysis",
        name: "CatColab Analysis",
        icon: "ChartSpline",
        // A blank analysis references no model, so hide it from the "new
        // document" menu; the model tool creates an analysis automatically
        // for every model instead.
        unlisted: true,
        async load() {
            const { dataType } = await import("./analysis_datatype");
            return dataType;
        },
    },
    {
        type: "patchwork:tool",
        id: "catcolab-analysis",
        name: "CatColab Analysis",
        icon: "ChartSpline",
        supportedDatatypes: ["catcolab-analysis"],
        async load() {
            const { renderAnalysisTool } = await import("./analysis_tool");
            return renderAnalysisTool;
        },
    },
    {
        // Instruction pack for Patchwork's chat computer (the `llm:skill`
        // type the chat tool consumes): how to build and edit stock-and-flow
        // models and their mass-action analyses with the generic document
        // tools. Auto-activates when a CatColab doc is focused.
        type: "llm:skill",
        id: "catcolab-stock-flow",
        name: "CatColab Stock & Flow",
        description:
            "Create and edit CatColab stock-and-flow models and mass-action simulation analyses. Applies when the focused document is a CatColab model/analysis, or when the user asks to model a system-dynamics problem.",
        datatypes: ["catcolab-model", "catcolab-analysis"],
        async load() {
            const { skill } = await import("./llm_skill");
            return skill;
        },
    },
];
