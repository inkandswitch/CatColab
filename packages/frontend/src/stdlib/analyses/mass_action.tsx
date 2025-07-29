import { createMemo, createSignal } from "solid-js";

import type {
  DblModel,
  JsResult,
  MassActionModelData,
  MassActionProblemData,
  ODEResult,
} from "catlog-wasm";
import type { ModelAnalysisProps } from "../../analysis";
import {
  type ColumnSchema,
  FixedTableEditor,
  Foldable,
  createNumericalColumn,
} from "../../components";
import type { MorphismDecl, ObjectDecl } from "../../model";
import type { ModelAnalysisMeta } from "../../theory";
import { ODEResultPlot, type ODEPlotData } from "../../visualization";
import { createModelODEPlot } from "./simulation";

import "./simulation.css";

/** Configuration for a mass-action ODE analysis of a model. */
export type MassActionContent = MassActionProblemData<string>;

type Simulator = (model: DblModel, data: MassActionModelData) => ODEResult;

/** Configure a mass-action ODE analysis for use with models of a theory. */
export function configureMassAction(options: {
  id?: string;
  name?: string;
  description?: string;
  simulate: Simulator;
  isState?: (ob: ObjectDecl) => boolean;
  isTransition?: (mor: MorphismDecl) => boolean;
}): ModelAnalysisMeta<MassActionContent> {
  const {
    id = "mass-action",
    name = "Mass-action dynamics",
    description = "Simulate the system using the law of mass action",
    ...otherOptions
  } = options;
  return {
    id,
    name,
    description,
    component: (props) => (
      <MassAction title={name} {...otherOptions} {...props} />
    ),
    initialContent: () => ({
      rates: {},
      initialValues: {},
      duration: 10,
    }),
  };
}

/** Analyze a model using mass-action dynamics. */
export function MassAction(
  props: ModelAnalysisProps<MassActionContent> & {
    simulate: Simulator;
    isState?: (ob: ObjectDecl) => boolean;
    isTransition?: (mor: MorphismDecl) => boolean;
    title?: string;
  }
) {
  // Parameter selection for sensitivity analysis
  type ParameterInfo = {
    id: string;
    name: string;
    type: "object" | "morphism";
  };

  const [selectedParameter, setSelectedParameter] =
    createSignal<ParameterInfo | null>(null);

  // Scenario selection state
  const scenarios = [
    { id: "half", multiplier: 0.5, label: "Half rate" },
    { id: "original", multiplier: 1.0, label: "Original rate" },
    { id: "double", multiplier: 2.0, label: "Double rate" },
  ];
  const [selectedScenario, setSelectedScenario] = createSignal("original");

  const obDecls = createMemo<ObjectDecl[]>(() => {
    return props.liveModel
      .formalJudgments()
      .filter((jgmt) => jgmt.tag === "object")
      .filter((ob) => props.isState?.(ob) ?? true);
  }, []);

  const morDecls = createMemo<MorphismDecl[]>(() => {
    return props.liveModel
      .formalJudgments()
      .filter((jgmt) => jgmt.tag === "morphism")
      .filter((mor) => props.isTransition?.(mor) ?? true);
  }, []);

  // Available parameters for sensitivity analysis
  const availableParameters = createMemo<ParameterInfo[]>(() => {
    const params: ParameterInfo[] = [];

    // Add object parameters (initial values)
    for (const ob of obDecls()) {
      params.push({
        id: ob.id,
        name: `${ob.name} (Initial value)`,
        type: "object",
      });
    }

    // Add morphism parameters (rates)
    for (const mor of morDecls()) {
      params.push({
        id: mor.id,
        name: `${mor.name} (Rate)`,
        type: "morphism",
      });
    }

    return params;
  });

  const obSchema: ColumnSchema<ObjectDecl>[] = [
    {
      contentType: "string",
      header: true,
      content: (ob) => ob.name,
    },
    createNumericalColumn({
      name: "Initial value",
      data: (ob) => props.content.initialValues[ob.id],
      validate: (_, data) => data >= 0,
      setData: (ob, data) =>
        props.changeContent((content) => {
          content.initialValues[ob.id] = data;
        }),
    }),
  ];

  const morSchema: ColumnSchema<MorphismDecl>[] = [
    {
      contentType: "string",
      header: true,
      content: (mor) => mor.name,
    },
    createNumericalColumn({
      name: "Rate",
      data: (mor) => props.content.rates[mor.id],
      default: 1,
      validate: (_, data) => data >= 0,
      setData: (mor, data) =>
        props.changeContent((content) => {
          content.rates[mor.id] = data;
        }),
    }),
  ];

  const toplevelSchema: ColumnSchema<null>[] = [
    createNumericalColumn({
      name: "Duration",
      data: (_) => props.content.duration,
      validate: (_, data) => data >= 0,
      setData: (_, data) =>
        props.changeContent((content) => {
          content.duration = data;
        }),
    }),
  ];

  const combinedPlotResult = createMemo(() => {
    const validated = props.liveModel.validatedModel();
    if (!validated || validated.result.tag !== "Ok") return undefined;

    const model = validated.model;
    const parameter = selectedParameter();

    // If no parameter is selected, show normal chart with current values
    if (!parameter) {
      const result = props.simulate(model, props.content);
      if (result.tag !== "Ok") return result as JsResult<ODEPlotData, string>;

      const obIndex = props.liveModel.objectIndex();
      const states = Array.from(result.content.states.entries()).map(
        ([id, data]) => ({
          name: obIndex.map.get(id) ?? "",
          data,
          selected: true, // Everything is selected in normal mode
        })
      );

      const content: ODEPlotData = {
        time: result.content.time,
        states,
      };

      return { tag: "Ok" as const, content };
    }

    // Sensitivity analysis mode - get base value for the selected parameter
    const baseValue =
      parameter.type === "object"
        ? props.content.initialValues[parameter.id] ?? 0
        : props.content.rates[parameter.id] ?? 1;

    // Run simulations for all scenarios
    const simulationResults = scenarios.map(({ id, multiplier, label }) => {
      const modifiedContent = {
        ...props.content,
        rates: { ...props.content.rates },
        initialValues: { ...props.content.initialValues },
      };

      // Apply multiplier to the selected parameter
      if (parameter.type === "object") {
        modifiedContent.initialValues[parameter.id] = baseValue * multiplier;
      } else {
        modifiedContent.rates[parameter.id] = baseValue * multiplier;
      }

      const result = props.simulate(model, modifiedContent);
      return { result, label, multiplier, id };
    });

    // Check if all simulations succeeded
    const allSuccessful = simulationResults.every(
      ({ result }) => result.tag === "Ok"
    );
    if (!allSuccessful) {
      // Return first error found
      const firstError = simulationResults.find(
        ({ result }) => result.tag === "Err"
      );
      return firstError?.result as JsResult<ODEPlotData, string>;
    }

    // Combine all successful results into one plot data structure
    const firstResult = simulationResults[0]!.result;
    if (firstResult.tag !== "Ok")
      return firstResult as JsResult<ODEPlotData, string>;

    const obIndex = props.liveModel.objectIndex();
    const combinedStates: Array<{
      name: string;
      data: number[];
      selected: boolean;
    }> = [];

    // For each simulation result, add its states with scenario labels
    for (const { result, label, id } of simulationResults) {
      if (result.tag === "Ok") {
        const solution = result.content;
        const isSelected = selectedScenario() === id;
        for (const [objectId, stateData] of solution.states.entries()) {
          const objectName = obIndex.map.get(objectId) ?? "";
          const scenarioStateName = `${objectName} (${label})`;
          combinedStates.push({
            name: scenarioStateName,
            data: stateData,
            selected: isSelected,
          });
        }
      }
    }

    const content: ODEPlotData = {
      time: firstResult.content.time,
      states: combinedStates,
    };

    return { tag: "Ok" as const, content };
  });

  return (
    <div class="simulation">
      <Foldable title={props.title}>
        <div class="parameters">
          <FixedTableEditor rows={obDecls()} schema={obSchema} />
          <FixedTableEditor rows={morDecls()} schema={morSchema} />
          <FixedTableEditor rows={[null]} schema={toplevelSchema} />
        </div>
      </Foldable>
      <div class="sensitivity-controls">
        <div class="parameter-selector">
          <label for="sensitivity-parameter">
            Sensitivity Analysis Parameter:
          </label>
          <select
            id="sensitivity-parameter"
            value={selectedParameter()?.id ?? ""}
            onChange={(e) => {
              const paramId = e.currentTarget.value;
              if (paramId) {
                const param = availableParameters().find(
                  (p) => p.id === paramId
                );
                setSelectedParameter(param || null);
              } else {
                setSelectedParameter(null);
              }
            }}
          >
            <option value="">None (show current values)</option>
            {availableParameters().map((param) => (
              <option value={param.id}>{param.name}</option>
            ))}
          </select>
        </div>
        {selectedParameter() && (
          <div class="scenario-selector">
            {scenarios.map((scenario) => (
              <button
                class={`scenario-tab ${
                  selectedScenario() === scenario.id ? "active" : ""
                }`}
                onClick={() => setSelectedScenario(scenario.id)}
              >
                {scenario.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ODEResultPlot result={combinedPlotResult()} />
    </div>
  );
}
