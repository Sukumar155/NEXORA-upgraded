/**
 * sosApi.ts — frontend client for the NEXORA SOS Signal backend bridge.
 *
 * - submitBeacon()    POST the one-tap SOS to the server (used by the store)
 * - fetchServerSOS()  catch-up pull of reports already on the server
 * - subscribeServerSOS()  live SSE stream so the authorities dashboard
 *                         receives new SOS reports the moment they arrive
 * - checkServerHealth()   quick connectivity check
 *
 * Backend base:  VITE_API_URL env var, or '' (same origin — proxied by Vite
 * dev server to http://localhost:3001). See .env.example.
 */

export interface BeaconPayload {
  lat: number;
  lng: number;
  accuracy?: number;
  locationName?: string;
  phone?: string;
  message?: string;
  needs?: string[];
  peopleCount?: number;
  source?: string;
}

export interface ServerSOS {
  id: string;
  type: string;
  source: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  locationName: string;
  phone: string;
  phoneMasked: string;
  peopleCount: number;
  needs: string[];
  message: string;
  priorityScore: number;
  priorityLevel: string;
  status: string;
  aiExplanation: string;
  timestamp: string;
}

export type SosServerStatus = 'CONNECTING' | 'LIVE' | 'OFFLINE';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';

/** Session token from OTP login, sent as a bearer token when present. */
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Sends the one-tap SOS beacon to the server. Returns the server report. */
export async function submitBeacon(payload: BeaconPayload): Promise<ServerSOS | null> {
  try {
    return await request<ServerSOS>('/api/sos', { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    return null; // backend offline — caller falls back to local-only mode
  }
}

/**
 * Pulls the latest reports already recorded by the server.
 *
 * Returns a discriminated result rather than a bare array: the caller used to
 * treat a failed fetch (which returned []) as success and paint the
 * "Server: Live" pill while the backend was actually down.
 */
export async function fetchServerSOS(
  limit = 50
): Promise<{ ok: true; reports: ServerSOS[] } | { ok: false; error: string }> {
  try {
    return { ok: true, reports: await request<ServerSOS[]>(`/api/sos?limit=${limit}`) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unreachable' };
  }
}

/** One-shot connectivity check (health endpoint). */
export async function checkServerHealth(): Promise<boolean> {
  try {
    await request<unknown>('/api/health');
    return true;
  } catch {
    return false;
  }
}

/* --------------------------- alerts & incidents -------------------------- */

export interface ServerAlert {
  id: string;
  title: string;
  severity: string;
  zone: string;
  locationName: string;
  lat: number;
  lng: number;
  reason: string;
  recommendedAction: string;
  channels: string[];
  affectedPopulation: number;
  active: boolean;
  issuedByRole: string;
  issuedByPhone: string;
  timestamp: string;
  /** Set when the bulletin is resolved; drives the 24-hour history strip. */
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface ServerIncident {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  lat: number;
  lng: number;
  locationName: string;
  peopleCount: number;
  needs: string[];
  contactPhone: string;
  status: string;
  timestamp: string;
}

/** Broadcast a CAP bulletin. Requires a DDMO_OFFICER session (HTTP 403 otherwise). */
export async function broadcastAlert(body: Record<string, unknown>) {
  return request<{ ok: true; alert: ServerAlert }>('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchAlerts(limit = 100): Promise<ServerAlert[]> {
  const res = await request<{ alerts: ServerAlert[] }>(`/api/alerts?limit=${limit}`);
  return res.alerts;
}

export async function setAlertActive(id: string, active: boolean) {
  return request<{ ok: true; alert: ServerAlert }>(`/api/alerts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}

/** File a full citizen incident report (persisted server-side). */
export async function fileIncident(body: Record<string, unknown>) {
  return request<{ ok: true; incident: ServerIncident }>('/api/incidents', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchIncidents(limit = 100): Promise<ServerIncident[]> {
  const res = await request<{ incidents: ServerIncident[] }>(`/api/incidents?limit=${limit}`);
  return res.incidents;
}

/** Triage a beacon: status (incl. FALSE_ALARM) and/or priority override. */
export async function triageSOS(
  id: string,
  patch: { status?: string; priorityScore?: number; note?: string }
) {
  return request<{ ok: true; report: ServerSOS }>(`/api/sos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Who am I? Used to confirm the stored session is still valid. */
export async function fetchSession() {
  return request<{ ok: true; phone: string; role: string; expiresAt: string }>(
    '/api/auth/session'
  );
}

/**
 * Subscribes to the server's SSE stream. Returns an unsubscribe function.
 * EventSource auto-reconnects, so network blips are handled for free.
 */
export function subscribeServerSOS(handlers: {
  onReport: (report: ServerSOS) => void;
  onStatus?: (status: SosServerStatus) => void;
}): () => void {
  let es: EventSource | null = null;
  try {
    es = new EventSource(`${API_BASE}/api/events`);
    es.onopen = () => handlers.onStatus?.('LIVE');
    es.onerror = () => handlers.onStatus?.('CONNECTING');
    es.addEventListener('sos', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data as string) as ServerSOS;
        handlers.onReport(data);
      } catch {
        /* ignore malformed payloads */
      }
    });
  } catch {
    handlers.onStatus?.('OFFLINE');
  }
  return () => {
    try {
      es?.close();
    } catch {
      /* noop */
    }
  };
}