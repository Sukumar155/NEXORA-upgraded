# NEXORA — PostgreSQL setup

NEXORA previously stored everything in hand-written JSON files
(`server/data/{alerts,incidents,sos}.json` plus `officers.json`). That worked for
a prototype but has three problems this setup removes:

- **Whole-file rewrites.** Every change re-read and re-wrote the entire file.
  `sos.json` is already 115 kB and grows without bound.
- **No locking.** Two writers can interleave and corrupt the file.
- **No queryable history.** "River level at Chepauk last Tuesday" was not a
  question the data could answer.

## The fallback is permanent, not temporary

`DATABASE_URL` is **optional**. With it unset the app runs exactly as before on
JSON, and if PostgreSQL is down at runtime `server/db.mjs` falls back per query.
`GET /api/health` always reports which backend is live:

```json
{ "db": { "backend": "postgresql", "configured": true, "error": null } }
{ "db": { "backend": "json-fallback", "configured": false, "error": null } }
```

The JSON files are never deleted by the migration. They remain the offline
fallback and a manual recovery path.

## Install

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --exact
```

The installer asks for a superuser password. Remember it — you need it to create
the app database.

## Create the database

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE ROLE nexora LOGIN PASSWORD 'nexora';"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE nexora OWNER nexora;"
```

## Point the app at it

```powershell
$env:DATABASE_URL = "postgresql://nexora:nexora@localhost:5432/nexora"
```

To make it permanent, put that line in `server/.env` (see `.env.example`) or in
your shell profile.

## Apply the schema and migrate

```powershell
node scripts/migrate.mjs
```

Idempotent — every insert is `ON CONFLICT DO NOTHING`, so running it twice
changes nothing. Confirm afterwards:

```powershell
node scripts/migrate.mjs --verify
```

## Tables

| table | replaces | notes |
|---|---|---|
| `officers` | `officers.json` | roster; role is authoritative |
| `alerts` | `alerts.json` | `active` is the single truth for the pill **and** the bell |
| `incidents` | `incidents.json` | citizen reports |
| `sos_reports` | `sos.json` | beacons; this is the one that grows fastest |
| `sensor_readings` | — | pre-shaped for the hardware work |
| `sensor_thresholds` | — | danger level per station, decided server-side |
| `otp_challenges` | in-memory `Map` | a restart no longer wipes pending logins |
| `sessions` | in-memory `Map` | same |
| `notification_targets` | — | who gets messaged; a table, not a constant |

### Why `payload jsonb`

The React store already models these records as rich objects. Promoting every
field to a column would mean rewriting the frontend's shapes and a brittle
migration. Instead the full record lives in `payload`, and the few columns the
database genuinely needs to filter or sort on are promoted alongside it. Reads
merge them back, so nothing upstream can tell the difference.

## Pre-shaped for the sensor work

`sensor_readings` uses a **BRIN** index on `recorded_at`. Gauge data arrives in
time order, and BRIN is a fraction of a btree's size for that — a btree would
grow large on continuous inserts.

The threshold lives in `sensor_thresholds`, not in the client, because the alert
decision must be made server-side: a browser can be closed, edited, or disagree
with itself. See the discussion in this repo about hysteresis before wiring it
up.

## Rollback

Stop the server, unset `DATABASE_URL`, restart. The JSON files are untouched and
the app carries on.
