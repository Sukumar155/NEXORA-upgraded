/**
 * floodRiskModel.ts — browser-side inference for the NEXORA flood-risk
 * XGBoost classifier (multi:softmax, 3 classes, 600 trees, 11 features).
 *
 * The model ships as a native XGBoost JSON dump. Rather than pull in a ~2 MB
 * wasm runtime, we walk the serialized trees directly: every node carries
 * `left_children` / `right_children` / `split_indices` / `split_conditions`,
 * so a prediction is a short root-to-leaf descent per tree. This is the same
 * arithmetic `Booster.predict()` performs, and it is verified against real
 * Python output by `scripts/verify-flood-model.mjs`.
 *
 * Model card (derived from the dump):
 *   classes   0 = Low, 1 = Moderate, 2 = High flood risk
 *   features  Temperature_C, Humidity_pct, Pressure_hPa, Rainfall_mm,
 *             Water_Level_cm, Latitude, Longitude, Elevation_m,
 *             River_Discharge_m3_s, Historical_Floods,
 *             Population_Density_per_km2
 *
 * Note on training domain: the tree splits only ever range across
 * lat 8.24-13.68 / lng 76.60-80.26 (South India). Coordinates outside that box
 * are not extrapolated by XGBoost — they collapse onto a single constant leaf,
 * so they act as a no-op rather than an error. Rainfall dominates the model
 * (~65% of total split gain), then water level, pressure and humidity.
 */
import type { LiveSensorMetric } from '../types/sensor';

export type FloodRiskClass = 'LOW' | 'MODERATE' | 'HIGH';

/** Label per class index, in the model's own 0/1/2 order. */
export const FLOOD_RISK_LABELS: readonly FloodRiskClass[] = ['LOW', 'MODERATE', 'HIGH'];

export interface FloodRiskFeatures {
  Temperature_C: number;
  Humidity_pct: number;
  Pressure_hPa: number;
  Rainfall_mm: number;
  Water_Level_cm: number;
  Latitude: number;
  Longitude: number;
  Elevation_m: number;
  River_Discharge_m3_s: number;
  Historical_Floods: number;
  Population_Density_per_km2: number;
}

export interface FloodRiskPrediction {
  /** Winning class label. */
  risk: FloodRiskClass;
  /** Raw class index as stored in the model (0/1/2). */
  classIndex: number;
  /** Softmax probability per class, index-aligned with FLOOD_RISK_LABELS. */
  probabilities: Record<FloodRiskClass, number>;
  /** Per-class margin (logit) — useful for explaining a borderline call. */
  margins: Record<FloodRiskClass, number>;
  /** Probability mass on the winning class. */
  confidence: number;
  /** True when any input sat outside the range the model actually splits on. */
  outOfDomain: boolean;
  /** Human-readable notes about any out-of-domain inputs. */
  warnings: string[];
}

/** One serialized tree, narrowed to the fields inference needs. */
interface FlatTree {
  left: Int32Array;
  right: Int32Array;
  splitIndex: Int32Array;
  splitCond: Float64Array;
  defaultLeft: Uint8Array;
  leafValue: Float64Array;
}

interface ModelBundle {
  trees: FlatTree[];
  /** Which class each tree contributes to, index-aligned with `trees`. */
  treeClass: number[];
  numClass: number;
  /** Per-class intercept, already in margin space. */
  baseScore: number[];
  featureNames: string[];
  /** min/max split threshold per feature — the effective training domain. */
  domainLo: number[];
  domainHi: number[];
  maxNodes: number;
  /** Total split gain per feature, index-aligned with featureNames. */
  gain: number[];
  splitCount: number[];
}

let cached: ModelBundle | null = null;
let loadPromise: Promise<ModelBundle> | null = null;

/** XGBoost's JSON stores several numeric fields as JSON-encoded strings. */
const asNumberArray = (v: unknown): number[] =>
  (typeof v === 'string' ? JSON.parse(v) : (v as number[])).map(Number);

/**
 * Split thresholds per feature, used to flag inputs the model was never
 * trained on. XGBoost cannot extrapolate past these, so such inputs silently
 * saturate — worth surfacing rather than hiding.
 */
function computeDomain(trees: FlatTree[], numFeature: number) {
  const lo = new Array(numFeature).fill(Infinity);
  const hi = new Array(numFeature).fill(-Infinity);
  for (const t of trees) {
    for (let i = 0; i < t.left.length; i++) {
      if (t.left[i] === -1) continue;
      const f = t.splitIndex[i];
      const c = t.splitCond[i];
      if (c < lo[f]) lo[f] = c;
      if (c > hi[f]) hi[f] = c;
    }
  }
  return { lo, hi };
}

function parseBundle(raw: string): ModelBundle {
  const json = JSON.parse(raw);
  const learner = json.learner;
  const gbm = learner.gradient_booster.model;
  const rawTrees: Record<string, unknown>[] = gbm.trees;
  const treeClass = asNumberArray(gbm.tree_info);

  const trees: FlatTree[] = rawTrees.map((t) => ({
    left: Int32Array.from(asNumberArray(t.left_children)),
    right: Int32Array.from(asNumberArray(t.right_children)),
    splitIndex: Int32Array.from(asNumberArray(t.split_indices)),
    splitCond: Float64Array.from(asNumberArray(t.split_conditions)),
    defaultLeft: Uint8Array.from(asNumberArray(t.default_left)),
    leafValue: Float64Array.from(asNumberArray(t.base_weights))
  }));

  const featureNames: string[] = learner.feature_names;
  const { lo, hi } = computeDomain(trees, featureNames.length);

  // Split-gain importance, measured from the trees themselves.
  const n = featureNames.length;
  const gain = new Array<number>(n).fill(0);
  const splitCount = new Array<number>(n).fill(0);
  for (const rt of rawTrees) {
    const left = asNumberArray(rt.left_children);
    const idx = asNumberArray(rt.split_indices);
    const loss = asNumberArray(rt.loss_changes);
    for (let i = 0; i < left.length; i++) {
      if (left[i] === -1) continue;
      const f = idx[i];
      splitCount[f]++;
      gain[f] += Math.abs(loss[i]);
    }
  }

  return {
    trees,
    treeClass,
    numClass: Number(learner.learner_model_param.num_class),
    baseScore: asNumberArray(learner.learner_model_param.base_score),
    featureNames,
    domainLo: lo,
    domainHi: hi,
    maxNodes: trees.reduce((m, t) => Math.max(m, t.left.length), 0),
    gain,
    splitCount
  };
}

export interface FeatureImportance {
  feature: string;
  /** Share of the model's total split gain, 0-100. */
  gainPct: number;
  splits: number;
}

/** Real feature importance read out of the loaded model, descending. */
export function featureImportance(model: ModelBundle = cached as ModelBundle): FeatureImportance[] {
  if (!model) throw new Error('Flood risk model not loaded.');
  const total = model.gain.reduce((a, b) => a + b, 0) || 1;
  return model.featureNames
    .map((feature, i) => ({
      feature,
      gainPct: (model.gain[i] / total) * 100,
      splits: model.splitCount[i]
    }))
    .sort((a, b) => b.gainPct - a.gainPct);
}

/** Expose the parsed bundle for callers that need model facts. */
export function getFloodModel(): ModelBundle | null {
  return cached;
}

/**
 * Load and parse the model JSON. Cached after the first call.
 * Pass the raw JSON text in (e.g. from a `?raw` fetch) to avoid a bundler
 * import that would inline 2 MB into the main chunk.
 */
export function loadFloodRiskModel(rawJson: string): ModelBundle {
  if (!cached) cached = parseBundle(rawJson);
  return cached;
}

export function isFloodModelLoaded(): boolean {
  return cached !== null;
}

/** Reset the cache — used by tests and the model hot-swap. */
export function resetFloodRiskModel(): void {
  cached = null;
  loadPromise = null;
}

/** Fetch the model from a URL and cache the parsed bundle. */
export async function fetchFloodRiskModel(url: string): Promise<ModelBundle> {
  if (cached) return cached;
  if (!loadPromise) {
    loadPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Flood model fetch failed: ${r.status}`);
        return r.text();
      })
      .then((text) => loadFloodRiskModel(text));
  }
  return loadPromise;
}

/** Root-to-leaf descent for one tree. */
function treePredict(t: FlatTree, x: Float64Array): number {
  let i = 0;
  // Iterative rather than recursive: deep trees would blow the JS stack.
  for (let guard = 0; guard < t.left.length; guard++) {
    const l = t.left[i];
    if (l === -1) return t.leafValue[i];
    const v = x[t.splitIndex[i]];
    // XGBoost routes NaN via default_left; NaN < c is false, so guard it.
    const goLeft = Number.isNaN(v) ? t.defaultLeft[i] === 1 : v < t.splitCond[i];
    i = goLeft ? l : t.right[i];
  }
  return t.leafValue[i];
}

/**
 * Run the classifier. Synchronous and allocation-light: safe to call on every
 * telemetry tick (it walks 600 trees, ~30k node visits).
 */
export function predictFloodRisk(
  features: FloodRiskFeatures,
  model: ModelBundle = cached as ModelBundle
): FloodRiskPrediction {
  if (!model) throw new Error('Flood risk model not loaded — call loadFloodRiskModel() first.');

  // Map the named feature object onto the model's positional order.
  const x = new Float64Array(model.featureNames.length);
  for (let i = 0; i < model.featureNames.length; i++) {
    x[i] = (features as unknown as Record<string, number>)[model.featureNames[i]];
  }

  const margins = new Array<number>(model.numClass).fill(0);
  for (let c = 0; c < model.numClass; c++) margins[c] = model.baseScore[c] ?? 0;

  for (let k = 0; k < model.trees.length; k++) {
    margins[model.treeClass[k]] += treePredict(model.trees[k], x);
  }

  // Softmax, max-shifted for numerical stability.
  let max = -Infinity;
  for (const m of margins) if (m > max) max = m;
  let sum = 0;
  const exps = margins.map((m) => {
    const e = Math.exp(m - max);
    sum += e;
    return e;
  });
  const probs = exps.map((e) => e / sum);

  let classIndex = 0;
  for (let c = 1; c < probs.length; c++) if (probs[c] > probs[classIndex]) classIndex = c;

  // Flag inputs outside the range the model actually splits on.
  const warnings: string[] = [];
  for (let i = 0; i < model.featureNames.length; i++) {
    const lo = model.domainLo[i];
    const hi = model.domainHi[i];
    if (lo === Infinity) continue; // feature never split on
    const v = x[i];
    if (v < lo || v > hi) {
      warnings.push(
        `${model.featureNames[i]}=${v} is outside the trained range ${lo}–${hi}; the model saturates here.`
      );
    }
  }

  const probabilityRecord = {} as Record<FloodRiskClass, number>;
  const marginRecord = {} as Record<FloodRiskClass, number>;
  for (let c = 0; c < model.numClass; c++) {
    probabilityRecord[FLOOD_RISK_LABELS[c]] = probs[c];
    marginRecord[FLOOD_RISK_LABELS[c]] = margins[c];
  }

  return {
    risk: FLOOD_RISK_LABELS[classIndex],
    classIndex,
    probabilities: probabilityRecord,
    margins: marginRecord,
    confidence: probs[classIndex],
    outOfDomain: warnings.length > 0,
    warnings
  };
}

/**
 * Build the feature vector from live app telemetry plus the static per-district
 * site descriptors now held in the store.
 *
 * Unit warning: the model's `Water_Level_cm` is *water depth above ground in
 * centimetres* (trained range 15.7-127.1), which is the sensor stations'
 * `waterLevelCm`. It is NOT the Brahmaputra stage in metres that `riverLevelMeters`
 * holds — converting that by x100 would be wrong by two orders of magnitude.
 */
export function featuresFromTelemetry(input: {
  metrics: LiveSensorMetric[];
  /** Water depth in cm, straight from a sensor station. */
  waterLevelCm: number;
  /** Barometric pressure in hPa, from a sensor station. */
  pressureHpa: number;
  latitude: number;
  longitude: number;
  elevationM: number;
  riverDischargeM3s: number;
  historicalFloods: number;
  populationDensityPerKm2: number;
}): FloodRiskFeatures {
  const pick = (id: string, fallback: number) => {
    const m = input.metrics.find((x) => x.id === id);
    return m ? m.value : fallback;
  };
  return {
    Temperature_C: pick('temp', 29),
    Humidity_pct: pick('humidity', 80),
    Pressure_hPa: input.pressureHpa,
    Rainfall_mm: pick('rain', 0),
    Water_Level_cm: input.waterLevelCm,
    Latitude: input.latitude,
    Longitude: input.longitude,
    Elevation_m: input.elevationM,
    River_Discharge_m3_s: input.riverDischargeM3s,
    Historical_Floods: input.historicalFloods,
    Population_Density_per_km2: input.populationDensityPerKm2
  };
}
