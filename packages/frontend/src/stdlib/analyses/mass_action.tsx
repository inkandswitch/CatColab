import { createMemo } from "solid-js";

import type {
  DblModel,
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
import { ODEResultPlot } from "../../visualization";
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

  const plotResults = createMemo(() => {
    const validated = props.liveModel.validatedModel();
    if (!validated || validated.result.tag !== "Ok") return [];

    const model = validated.model;
    const morphisms = morDecls();
    if (morphisms.length === 0) return [];

    const firstMorphismId = morphisms[0]!.id;
    const baseRate = props.content.rates[firstMorphismId] ?? 1;

    // Create three variations: half, original, double
    const variations = [
      { multiplier: 0.5, label: "Half rate" },
      { multiplier: 1.0, label: "Original rate" },
      { multiplier: 2.0, label: "Double rate" },
    ];

    return variations
      .map(({ multiplier, label }) => {
        // Create modified content with adjusted rate
        const modifiedContent = {
          ...props.content,
          rates: {
            ...props.content.rates,
            [firstMorphismId]: baseRate * multiplier,
          },
        };

        // Use createModelODEPlot to properly transform the result
        const plotMemo = createModelODEPlot(
          () => props.liveModel,
          (model) => props.simulate(model, modifiedContent)
        );

        const result = plotMemo();
        return {
          result,
          label,
          multiplier,
          hasValidResult: result !== undefined,
        };
      })
      .filter((plotData) => plotData.hasValidResult);
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
      <div class="simulation-plots">
        {plotResults().map((plotData, index) => (
          <div class="simulation-plot">
            <h4>
              {plotData.label} (×{plotData.multiplier})
            </h4>
            <ODEResultPlot result={plotData.result!} />
          </div>
        ))}
      </div>
    </div>
  );
}
