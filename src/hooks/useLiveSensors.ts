import { useEffect } from 'react';
import { useNexoraStore } from '../store/useNexoraStore';

/** Refresh cadence for the 5 live metric readings. */
export const LIVE_SENSOR_INTERVAL_MS = 5000;

/**
 * Drives the shared live-sensor feed on a 5-second cadence.
 *
 * Mount this once in any component that renders the live strip (the Sensors
 * page and the Citizen Portal). Because the readings live in the store, both
 * surfaces show the same numbers, and only one page is mounted at a time, so
 * there is never more than a single interval running.
 *
 * The feed pauses when the operator has toggled the app into offline mode or
 * paused sensor streaming, so a simulated drop doesn't drift in the background.
 */
export function useLiveSensors(): void {
  const isSensorStreaming = useNexoraStore(s => s.isSensorStreaming);
  const isOffline = useNexoraStore(s => s.isOffline);
  const mapDataStatus = useNexoraStore(s => s.mapDataStatus);
  const sensorTick = useNexoraStore(s => s.sensorTick);

  const paused = !isSensorStreaming || isOffline || mapDataStatus === 'OFFLINE';

  useEffect(() => {
    if (paused) return;
    const id = setInterval(sensorTick, LIVE_SENSOR_INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, sensorTick]);
}
