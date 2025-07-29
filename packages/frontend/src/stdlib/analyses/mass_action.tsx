import { createMemo } from "solid-js";

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
    const morphisms = morDecls();
    if (morphisms.length === 0) return undefined;

    const firstMorphismId = morphisms[0]!.id;
    const baseRate = props.content.rates[firstMorphismId] ?? 1;

    // Create three variations: half, original, double
    const variations = [
      { multiplier: 0.5, label: "Half rate" },
      { multiplier: 1.0, label: "Original rate" },
      { multiplier: 2.0, label: "Double rate" },
    ];

    // Run simulations for all variations
    const simulationResults = variations.map(({ multiplier, label }) => {
      const modifiedContent = {
        ...props.content,
        rates: {
          ...props.content.rates,
          [firstMorphismId]: baseRate * multiplier,
        },
      };

      const result = props.simulate(model, modifiedContent);
      return { result, label, multiplier };
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
    const combinedStates: Array<{ name: string; data: number[] }> = [];

    // For each simulation result, add its states with scenario labels
    for (const { result, label } of simulationResults) {
      if (result.tag === "Ok") {
        const solution = result.content;
        for (const [objectId, stateData] of solution.states.entries()) {
          const objectName = obIndex.map.get(objectId) ?? "";
          const scenarioStateName = `${objectName} (${label})`;
          combinedStates.push({
            name: scenarioStateName,
            data: stateData,
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
      <ODEResultPlot result={combinedPlotResult()} />
    </div>
  );
}
