# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## NEXORA AI Chatbot

The floating chatbot (bottom-right) is now a **mini-ChatGPT style assistant** backed by a real LLM instead of only fixed canned answers.

**How it works**
- Uses an OpenAI-compatible Chat Completions endpoint (`src/services/llmService.ts`).
- Defaults to the free, no-key Pollinations.ai model (**`model: openai`**). Requests are relayed through the bundled Node backend (`POST /api/chat` in `server/sos-server.mjs`): Pollinations now answers real browsers with `403 "Missing Turnstile token"` (a browser must send its foreign `Origin` header; the provider blocks those without a CAPTCHA token). The backend fetches Pollinations server-side — no `Origin` header, so it always works. The browser talks to our own backend same-origin (Vite proxy), so **no API key and no CAPTCHA needed**.
- At every message it injects a **live telemetry snapshot** from the Zustand store (`src/services/chatEngine.ts`) so answers about risk, water level, shelters, hospitals, incidents, routes, supplies, and helplines are correct and current.
- Replies **in the same language you type or speak** (English / தமிழ் / हिन्दी / తెలుగు / മലയാളം / বাংলা) — the model detects the language.
- When the answer references a place, the model appends a `[LOC:{...}]` block which the UI parses back into **Open in Maps / Get Directions / Google Maps** action buttons.
- Conversations have memory (last 16 messages) and stream tokens live with a typewriter effect + Stop button.
- If the LLM is unreachable (offline / endpoint down), it gracefully falls back to the built-in keyword engine.

**Bring your own model (optional)**
Any OpenAI-compatible endpoint works. See `.env.example` for `VITE_CHAT_API_URL`, `VITE_CHAT_API_KEY`, `VITE_CHAT_MODEL`, or set the same keys at runtime via `localStorage` in the browser console (no rebuild needed). When you configure your own endpoint, it is tried first and the free relay is the automatic fallback.

**Troubleshooting the AI dot:** 🔴 **AI Offline** means neither your endpoint nor the backend relay answered. Tap **Retry AI** in the amber notice bar (the backend must be running for the free AI — use `npm run dev:all`). If you previously set a bad `nexora_chat_url` in `localStorage`, the app now auto-falls back to the working default, but you can also clear it with `localStorage.removeItem('nexora_chat_url')` and refresh.

## SOS Signal — Citizen one-tap emergency beacon + backend bridge

The **SOS Signal** button (Citizen Portal → red warning banner, right of "Report Trapped Person") detects the citizen's live location with the browser Geolocation API and raises a **CRITICAL SOS** with the exact coordinates — no form filling needed. It's not limited to native apps; any modern browser on a phone (GPS) or laptop (WiFi/network) supports it.

- Detection: `navigator.geolocation` (`src/services/geolocationService.ts`) with a reverse-geocode to a place name (OpenStreetMap Nominatim) and a raw-coordinates fallback when offline.
- Local store (`src/store/useNexoraStore.ts` → `submitQuickSOS`): the beacon appears instantly in the authorities' Priority SOS Queue and is pinned on the disaster map.
- **Deliberate activation** (`src/hooks/useSosActivation.ts`): a beacon needs **3 quick taps or a 5-second hold**. A single stray tap used to dispatch straight to the SEOC queue, and false alarms are how responders learn to discount the channel. Both paths stay available so it stays fast but never accidental; every tap vibrates so it is confirmable by feel.
- **Backend bridge (`server/sos-server.mjs`)** — a zero-dependency Node server that actually receives the SOS over HTTP, persists it to `server/data/sos.json`, and pushes it **live** to every open dashboard over SSE:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/sos` | Accept & validate a citizen SOS beacon (201 + stored report) |
| `GET /api/sos` | List stored reports (latest first, `?limit=`) |
| `PATCH /api/sos/:id` | Triage a beacon — status (incl. `FALSE_ALARM`), priority override, note. **DDMO only** |
| `GET /api/events` | SSE stream — pushes new SOS reports and `alert` events to dashboards instantly |
| `GET /api/health` | Health/uptime/counts |
| `POST /api/chat` | AI relay — streams LLM chat completions for the chatbot (bypasses the provider's browser CAPTCHA; override with `LLM_RELAY_URL`) |
| `POST /api/yolo/detect` | Real YOLO inference on an uploaded image — see `server/YOLO_SETUP.md` |
| `POST /api/auth/otp/request` | Issue a real SMS OTP — see `server/OTP_SETUP.md` |
| `POST /api/auth/otp/verify` | Exchange the OTP for a session token |
| `GET /api/auth/otp/status` | Which SMS provider is active, and whether a gateway is configured |
| `GET /api/auth/session` | The current session (phone, role, expiry) |
| `GET`/`POST` `/api/alerts` | CAP bulletins — list / broadcast (**DDMO only**) |
| `PATCH /api/alerts/:id` | Resolve or re-activate a bulletin (**DDMO only**) |
| `GET`/`POST` `/api/incidents` | Citizen incident reports — list / file |
| `PATCH /api/incidents/:id` | Update incident status (**DDMO only**) |

### Authorisation model

`server/directory.mjs` holds the officer roster (`server/officers.json`, seeded on
first run). **A phone number's role comes from that roster, never from the request
body** — otherwise anyone could POST `{"role":"DDMO_OFFICER"}` and mint an officer
session. Unknown numbers sign in as `CITIZEN`.

**Registering a posting** (this is required, or authority sign-in will not work):

```bash
npm run roster                                        # show the current roster
npm run roster:add -- +919876543210 DDMO_OFFICER "K. Iyer"
npm run roster -- --remove +919876543210
```

No restart needed — the roster is re-read on every sign-in.

If you pick a posting your number is not registered for, the OTP still verifies but
the login screen explains that the roster assigns a different role and lets you
continue with the granted one, use a different number, or see the `roster:add`
command. It never silently drops you into the citizen portal.

| Action | Who |
| --- | --- |
| Raise an SOS beacon | Anyone, **including signed-out** — an emergency call must never be blocked. Beacons record `verified: true/false` so triage can see provenance at a glance. |
| File an incident report | `CITIZEN` or any officer |
| Broadcast a CAP alert, triage the SOS queue, resolve bulletins | `DDMO_OFFICER` only |

Writes are rate limited (20/min per session or IP; SOS beacons 12/min) so a single
client cannot flood the live queue. CORS is locked to `CORS_ORIGINS` (default
`http://localhost:5173`) — it used to be `*` across the whole API, which is not
acceptable once the API issues sessions and mutates records.

### Verifying the backend

```bash
npm run dev:all        # in one terminal
npm run test:api       # in another
```

`test:api` runs 28 real checks against the live server and prints PASS/FAIL per
check, exiting non-zero on failure (so it works in CI):

```
1. Service reachability          health, counts
2. SMS OTP flow                  bad number, issue, wrong code, verify, replay
3. Authorisation                 escalation attempt, 401/403 on privileged writes
4. Roster grants officer roles   officer CAN broadcast, records who issued it
5. SOS beacon                    works signed-out, records provenance
6. CORS is not wide open         foreign origin is not reflected
7. AI chat relay
8. YOLO vision                   skipped unless --yolo
9. Rate limiting                 deliberately trips the limiter
```

Options:

```bash
npm run test:api -- --yolo                          # include real inference (~30-90s)
npm run test:api -- --url http://localhost:5173     # test through the Vite proxy
```

⚠️ Section 9 trips the rate limiter on purpose, so **wait ~60s before re-running**,
otherwise the beacon check in section 5 will correctly return 429. The script
prints a reminder when this happens.

To see the backend work by hand:

```powershell
# is it up, and what does it hold?
curl http://localhost:3001/api/health

# watch the server log — every OTP is printed in dev mode
npm run server

# prove a write needs auth
curl -X POST -H "Content-Type: application/json" -d '{\"title\":\"x\"}' http://localhost:3001/api/alerts
# -> {"ok":false,"error":"Sign in to perform this action."}
```

### Dry Evacuation Corridor (route planner)

`src/components/routing/DryCorridorPlanner.tsx` is used by **both** the authority
Evacuation page and the citizen portal, so the two cannot drift apart. The geometry
lives in `src/services/corridorPlanner.ts` and is real: it measures the live
`blockedRoads` list against the corridor from the viewer's position to the shelter
and pushes a detour sideways until every blocker is clear.

| Verdict | Meaning |
| --- | --- |
| `DRY_CORRIDOR_SAFE` | Nothing active within 120 m of the corridor |
| `CAUTION_SHALLOW_SURGE` | Detoured around a blockage; longer on purpose, and it says which road and why |
| `BLOCKED` | The corridor could not be cleared (e.g. the shelter access itself is cut). The citizen copy says **do not use this route** |

This was previously a hardcoded `riskRating: "DRY_CORRIDOR_SAFE"` with a fixed
0.0025° midpoint offset and a canned "avoid the Otteri nullah roadblock"
direction — it never read `blockedRoads` at all. Tolerable on an operator screen;
not tolerable in the citizen portal, where someone wading through floodwater
trusts the word "SAFE".

Verify the maths:

```bash
npm run verify:corridor   # 23 checks against the real planner module
```

### Smoke tests

```bash
npm run smoke:flood     # scores the real districts through the XGBoost model
npm run smoke:weather   # live Open-Meteo check per district
npm run verify:flood    # parity vs real Python XGBoost output
npm run verify:corridor # dry-corridor detour geometry
```

⚠️ `smoke:flood` currently reports **all three districts as out-of-domain**:
`flood_risk_xgboost` was trained on lat 8.24–13.68 / lng 76.60–80.26 with river
discharge 33.7–141.8 m³/s, but Chennai's longitude (80.2707) sits just outside the
range and Cuddalore/Kochi discharge exceeds it. The UI *does* surface this
(`FloodRiskCard` shows the domain warnings), but the model's output for these
districts should be treated as unreliable until it is retrained. That needs the
original training dataset, which is not in this repo.

**Run it:**
```bash
npm run dev:all     # backend (localhost:3001) + Vite app (localhost:5173) together
# or, in two terminals:
npm run server      # SOS backend only
npm run dev         # Vite app only
```
The Vite dev server proxies `/api/*` to `http://localhost:3001`, so the frontend just uses relative URLs. Hosted separately? Set `VITE_API_URL` (see `.env.example`). To demo the live bridge: click **SOS Signal** in one browser tab (citizen), then open the **Priority SOS Triage** queue in another tab — the report appears in real time, with the **Server: Live** pill in the queue header. If the backend isn't running, the app still works fully locally and shows **Server: Offline**.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
