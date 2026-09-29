import { useEffect, useRef } from 'react';
import { useNexoraStore } from '../store/useNexoraStore';

/** Open-Meteo is polled well inside its free-tier limits. */
export const WEATHER_POLL_MS = 5 * 60 * 1000;

/**
 * Keep the weather snapshot fresh.
 *
 * Mount once, globally (App), so the reading is already warm by the time any
 * page or the Citizen Portal renders it. Polling pauses while the app is in
 * offline simulation and resumes — with an immediate refetch — when the
 * operator comes back online. Changing district refetches immediately.
 */
export function useWeatherFeed(): void {
  const refreshWeather = useNexoraStore((s) => s.refreshWeather);
  const isOffline = useNexoraStore((s) => s.isOffline);
  const mapDataStatus = useNexoraStore((s) => s.mapDataStatus);
  const latitude = useNexoraStore((s) => s.districtSite.latitude);
  const longitude = useNexoraStore((s) => s.districtSite.longitude);

  const offline = isOffline || mapDataStatus === 'OFFLINE';
  const wasOffline = useRef(offline);

  // Initial load + district changes.
  useEffect(() => {
    void refreshWeather();
    // refreshWeather is stable for the lifetime of the store.
  }, [refreshWeather, latitude, longitude]);

  // Coming back online: refetch straight away rather than waiting a full cycle.
  useEffect(() => {
    if (wasOffline.current && !offline) {
      void refreshWeather();
    }
    wasOffline.current = offline;
  }, [offline, refreshWeather]);

  // Periodic poll, only while online.
  useEffect(() => {
    if (offline) return;
    const id = setInterval(() => void refreshWeather(), WEATHER_POLL_MS);
    return () => clearInterval(id);
  }, [offline, refreshWeather]);
}
