import { useEffect, useMemo, useState } from 'react';
import { useNexoraStore } from '../store/useNexoraStore';
import {
  fetchFloodRiskModel,
  predictFloodRisk,
  featuresFromTelemetry,
  featureImportance,
  FLOOD_RISK_LABELS,
  type FeatureImportance,
  type FloodRiskFeatures,
  type FloodRiskPrediction
} from '../services/floodRiskModel';

export const FLOOD_MODEL_URL = `${import.meta.env.BASE_URL}models/flood_risk_xgboost.json`;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface UseFloodRiskResult {
  state: LoadState;
  error: string | null;
  prediction: FloodRiskPrediction | null;
  features: FloodRiskFeatures | null;
  /** True feature importance measured from the model, descending. */
  importance: FeatureImportance[];
}

/**
 * Loads the flood-risk XGBoost model and scores the live telemetry snapshot.
 *
 * The 2 MB model is fetched once and cached in module scope, so navigating away
 * and back does not re-download it. Re-scoring is synchronous and cheap
 * (~30k node visits), so it simply re-runs whenever the 5s telemetry tick or
 * the selected district changes.
 */
export function useFloodRisk(): UseFloodRiskResult {
  // Start in 'loading': the fetch below always runs on mount.
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [importance, setImportance] = useState<FeatureImportance[]>([]);

  const liveSensorMetrics = useNexoraStore((s) => s.liveSensorMetrics);
  const sensorStations = useNexoraStore((s) => s.sensorStations);
  const districtSite = useNexoraStore((s) => s.districtSite);

  useEffect(() => {
    let cancelled = false;

    fetchFloodRiskModel(FLOOD_MODEL_URL)
      .then((bundle) => {
        if (cancelled) return;
        setImportance(featureImportance(bundle));
        setState('ready');
        setError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setState('error');
        setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Water depth + pressure come from the station mesh, not the 5-metric strip.
  const reference = sensorStations[0];

  const features = useMemo<FloodRiskFeatures | null>(
    () =>
      reference
        ? featuresFromTelemetry({
            metrics: liveSensorMetrics,
            waterLevelCm: reference.waterLevelCm,
            pressureHpa: reference.pressureHpa,
            latitude: districtSite.latitude,
            longitude: districtSite.longitude,
            elevationM: districtSite.elevationM,
            riverDischargeM3s: districtSite.riverDischargeM3s,
            historicalFloods: districtSite.historicalFloods,
            populationDensityPerKm2: districtSite.populationDensityPerKm2
          })
        : null,
    [liveSensorMetrics, reference, districtSite]
  );

  const prediction = useMemo<FloodRiskPrediction | null>(() => {
    if (state !== 'ready' || !features) return null;
    try {
      return predictFloodRisk(features);
    } catch {
      // Scoring failed despite a loaded model — surface as "no prediction".
      return null;
    }
  }, [state, features]);

  return { state, error, prediction, features, importance };
}

export { FLOOD_RISK_LABELS };
export type { FloodRiskPrediction, FloodRiskFeatures };
