/**
 * db.mjs — PostgreSQL access with a JSON fallback.
 *
 * WHY A FALLBACK
 * NEXORA ran on hand-written JSON files in server/data/. Switching to
 * PostgreSQL is a clear upgrade (no read-modify-write of a whole file per
 * change, real locking, queryable history), but it must not become a single
 * point of failure: if the service is down or the connection string is missing,
 * the app has to keep working on JSON rather than 500 on every route. So every
 * call here is a promise that either uses PostgreSQL or transparently falls
 * back, and `dbStatus()` reports which is live.
 *
 * WHY `payload jsonb`
 * The React store and the API already model these records as rich objects.
 * Promoting every field to a column would mean rewriting the frontend's shapes
 * and a brittle migration. Instead the full record is kept in `payload` and the
 * few columns the database actually needs to filter, sort or index on are
 * promoted alongside it. Reads merge them back into the original shape, so
 * nothing upstream can tell the difference.
 *
 * WHY POOLLED
 * `pg` hands out one client per connection. A global sensor pushing readings
 * every 30s plus a dashboard polling every second would exhaust connections
 * fast. A pool bounds it.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

/** Set DATABASE_URL to switch PostgreSQL on. Absent -> JSON only. */
const CONNECTION = process.env.DATABASE_URL || '';
/** Fail fast rather than hanging a request for 30s on a dead database. */
const CONNECT_TIMEOUT_MS = Number(process.env.PG_CONNECT_TIMEOUT_MS) || 3000;

let pool = null;
let pgReady = false;
let lastPgError = null;

/* ------------------------------ JSON fallback ------------------------------ */

function fileFor(kind) {
  return join(DATA_DIR, `${kind}.json`);
}

function jsonLoad(kind) {
  try {
    const f = fileFor(kind);
    if (existsSync(f)) {
      const parsed = JSON.parse(readFileSync(f, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn(`[db] could not read ${kind}.json:`, err.message);
  }
  return [];
}

function jsonPersist(kind, rows) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(fileFor(kind), JSON.stringify(rows, null, 2));
  } catch (err) {
    console.warn(`[db] could not write ${kind}.json:`, err.message);
  }
}

/* -------------------------------- lifecycle -------------------------------- */

/**
 * Connect if configured. Never throws: a database that is merely absent is not
 * an error condition, it just means the app runs on JSON.
 */
export async function initDb() {
  if (!CONNECTION) {
    console.log('[db] DATABASE_URL not set - using JSON files in server/data/');
    return { ok: false, reason: 'not-configured' };
  }
  try {
    const { default: pg } = await import('pg');
    const { Pool, types } = pg;

    // int8 (bigserial) arrives as a string by default because JS numbers cannot
    // hold every int64. sensor_readings.id is a bigserial and nothing does
    // arithmetic on it, so parse it as a number for consistency with the rest.
    types.setTypeParser(20, (v) => Number(v));

    pool = new Pool({
      connectionString: CONNECTION,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      max: Number(process.env.PG_POOL_MAX) || 10,
      idleTimeoutMillis: 30_000,
      ssl: /sslmode=require/.test(CONNECTION) ? { rejectUnauthorized: false } : undefined,
    });

    // An idle client erroring out (server restart, network blip) must not take
    // the process down — the pool discards it and opens a new one on demand.
    pool.on('error', (err) => {
      pgReady = false;
      lastPgError = err;
      console.warn('[db] idle client error:', err.message);
    });

    const probe = await pool.query('SELECT 1');
    pgReady = Boolean(probe.rows);
    console.log(`[db] PostgreSQL connected${pgReady ? '' : ' (probe failed)'}`);
    return { ok: pgReady };
  } catch (err) {
    pgReady = false;
    lastPgError = err;
    console.warn(`[db] PostgreSQL unavailable (${err.message}) - falling back to JSON`);
    return { ok: false, reason: err.message };
  }
}

/** Live status, surfaced on /api/health so a degraded mode is visible. */
export function dbStatus() {
  return {
    backend: pgReady ? 'postgresql' : 'json-fallback',
    configured: Boolean(CONNECTION),
    error: lastPgError ? String(lastPgError.message) : null,
  };
}

export async function closeDb() {
  if (pool) {
    try { await pool.end(); } catch { /* closing anyway */ }
    pool = null;
    pgReady = false;
  }
}

/* --------------------------------- queries -------------------------------- */

/** Run a query, or return null when PostgreSQL is not usable. */
async function q(text, params) {
  if (!pgReady || !pool) return null;
  try {
    return await pool.query(text, params);
  } catch (err) {
    lastPgError = err;
    console.warn('[db] query failed, using JSON fallback:', err.message);
    return null;
  }
}

const isPg = (r) => r !== null;

/* ---------------------------------- alerts --------------------------------- */

const ALERT_COLS = `id, type, title, severity, zone, location_name, reason,
  recommended_action, channels, affected_population, lat, lng, active,
  issued_by_role, issued_by_phone, resolved_at, resolved_by, created_at,
  updated_at, payload`;

/** Rebuild the app's alert shape from a row, with payload filling the gaps. */
function rowToAlert(row) {
  return {
    ...(row.payload || {}),
    id: row.id,
    type: row.type,
    title: row.title,
    severity: row.severity,
    zone: row.zone ?? '',
    locationName: row.location_name ?? '',
    reason: row.reason ?? '',
    recommendedAction: row.recommended_action ?? '',
    channels: row.channels || [],
    affectedPopulation: row.affected_population ?? 0,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    active: row.active,
    issuedByRole: row.issued_by_role,
    issuedByPhone: row.issued_by_phone,
    timestamp: row.payload?.timestamp ?? row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    updatedAt: row.updated_at,
  };
}

export async function listAlerts(limit = 100) {
  const r = await q(
    `SELECT ${ALERT_COLS} FROM alerts ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  if (isPg(r)) return r.rows.map(rowToAlert);
  return jsonLoad('alerts').slice(0, limit);
}

export async function insertAlert(alert) {
  const r = await q(
    `INSERT INTO alerts
       (id, type, title, severity, zone, location_name, reason,
        recommended_action, channels, affected_population, lat, lng, active,
        issued_by_role, issued_by_phone, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING ${ALERT_COLS}`,
    [
      alert.id, alert.type ?? 'CAP_BULLETIN', alert.title, alert.severity,
      alert.zone ?? null, alert.locationName ?? null, alert.reason ?? null,
      alert.recommendedAction ?? null, alert.channels ?? [], alert.affectedPopulation ?? 0,
      alert.lat ?? null, alert.lng ?? null, alert.active ?? true,
      alert.issuedByRole ?? null, alert.issuedByPhone ?? null,
      JSON.stringify(alert),
    ]
  );
  if (isPg(r) && r.rows.length) return rowToAlert(r.rows[0]);
  if (isPg(r)) return null;              // duplicate id — already stored
  const rows = jsonLoad('alerts');
  rows.unshift(alert);
  jsonPersist('alerts', rows);
  return alert;
}

export async function updateAlertActive(id, active, resolvedBy) {
  const r = await q(
    `UPDATE alerts
        SET active = $2,
            updated_at = now(),
            resolved_at = CASE WHEN $2 THEN NULL ELSE COALESCE(resolved_at, now()) END,
            resolved_by  = CASE WHEN $2 THEN NULL ELSE $3 END
      WHERE id = $1
      RETURNING ${ALERT_COLS}`,
    [id, Boolean(active), resolvedBy ?? null]
  );
  if (isPg(r)) return r.rows.length ? rowToAlert(r.rows[0]) : null;

  const rows = jsonLoad('alerts');
  const a = rows.find((x) => x.id === id);
  if (!a) return null;
  a.active = Boolean(active);
  a.updatedAt = new Date().toISOString();
  a.resolvedAt = active ? null : (a.resolvedAt || a.updatedAt);
  a.resolvedBy = active ? null : (resolvedBy ?? a.resolvedBy ?? null);
  jsonPersist('alerts', rows);
  return a;
}

/** Delete resolved bulletins past the retention window. */
export async function purgeAlerts(ttlMs) {
  const cutoff = new Date(Date.now() - ttlMs);
  const r = await q(
    `DELETE FROM alerts
      WHERE NOT active
        AND resolved_at IS NOT NULL
        AND resolved_at < $1`,
    [cutoff]
  );
  if (isPg(r)) return r.rowCount;

  const before = jsonLoad('alerts').length;
  const rows = jsonLoad('alerts').filter(
    (a) => a.active || !a.resolvedAt || new Date(a.resolvedAt) > cutoff
  );
  jsonPersist('alerts', rows);
  return before - rows.length;
}

/* -------------------------------- incidents -------------------------------- */

export async function listIncidents(limit = 100) {
  const r = await q(
    `SELECT * FROM incidents ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  if (isPg(r)) {
    return r.rows.map((row) => ({
      ...(row.payload || {}),
      id: row.id, title: row.title, description: row.description ?? '',
      category: row.category, severity: row.severity, status: row.status,
      zone: row.zone ?? '', locationName: row.location_name ?? '',
      lat: row.lat ?? 0, lng: row.lng ?? 0,
      reportedBy: row.reported_by, reportedByRole: row.reported_by_role,
      assignedTeam: row.assigned_team ?? '',
      timestamp: row.payload?.timestamp ?? row.created_at,
    }));
  }
  return jsonLoad('incidents').slice(0, limit);
}

export async function insertIncident(incident) {
  const r = await q(
    `INSERT INTO incidents
       (id, title, description, category, severity, status, zone, location_name,
        lat, lng, reported_by, reported_by_role, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      incident.id, incident.title, incident.description ?? null,
      incident.category ?? null, incident.severity ?? null,
      incident.status ?? 'PENDING', incident.zone ?? null,
      incident.locationName ?? null, incident.lat ?? null, incident.lng ?? null,
      incident.reportedBy ?? null, incident.reportedByRole ?? null,
      JSON.stringify(incident),
    ]
  );
  if (isPg(r) && r.rows.length) return r.rows[0];
  if (isPg(r)) return null;
  const rows = jsonLoad('incidents');
  rows.unshift(incident);
  jsonPersist('incidents', rows);
  return incident;
}

/* ------------------------------- sos reports ------------------------------- */

export async function listSos(limit = 50) {
  const r = await q(
    `SELECT * FROM sos_reports ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  if (isPg(r)) {
    return r.rows.map((row) => ({ ...(row.payload || {}), id: row.id, priority: row.priority, status: row.status, verified: row.verified }));
  }
  return jsonLoad('sos').slice(0, limit);
}

export async function insertSos(report) {
  const r = await q(
    `INSERT INTO sos_reports
       (id, phone, name, lat, lng, accuracy, message, place_label, category,
        priority, status, verified, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      report.id, report.phone ?? null, report.name ?? null,
      report.lat ?? null, report.lng ?? null, report.accuracy ?? null,
      report.message ?? null, report.place ?? report.placeLabel ?? null,
      report.category ?? null, report.priority ?? 'NORMAL',
      report.status ?? 'NEW', report.verified ?? false,
      JSON.stringify(report),
    ]
  );
  if (isPg(r)) return r.rows.length ? report : null;
  const rows = jsonLoad('sos');
  rows.unshift(report);
  jsonPersist('sos', rows.slice(0, 2000));
  return report;
}

export async function updateIncidentStatus(id, status) {
  const r = await q(
    'UPDATE incidents SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, status',
    [id, status]
  );
  if (isPg(r)) return r.rows.length ? { id, status } : null;
  return null;
}

/* -------------------------------- officers --------------------------------- */

export async function lookupOfficer(phone) {
  const r = await q(
    'SELECT phone, name, role FROM officers WHERE phone = $1 AND active',
    [phone]
  );
  if (isPg(r)) return r.rows[0] ?? null;
  return null; // roster stays in officers.json; directory.mjs owns that lookup
}

export async function listOfficers() {
  const r = await q('SELECT phone, name, role FROM officers WHERE active ORDER BY role, name');
  return isPg(r) ? r.rows : null;
}

/* --------------------------- sensor (future use) -------------------------- */

export async function insertSensorReading(reading) {
  const r = await q(
    `INSERT INTO sensor_readings
       (station_id, water_level_cm, rainfall_mm, battery_pct, rssi_dbm, payload)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
    [
      reading.stationId, reading.waterLevelCm ?? null, reading.rainfallMm ?? null,
      reading.batteryPct ?? null, reading.rssi ?? null, JSON.stringify(reading),
    ]
  );
  return isPg(r) ? r.rows[0] : null;
}

export async function getThreshold(stationId) {
  const r = await q(
    'SELECT * FROM sensor_thresholds WHERE station_id = $1',
    [stationId]
  );
  return isPg(r) ? (r.rows[0] ?? null) : null;
}
