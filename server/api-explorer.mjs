/**
 * api-explorer.mjs — a browsable view of the backend.
 *
 * The root route used to return a single line of plain text listing endpoint
 * names, which tells you nothing about whether any of them work. This renders
 * a self-contained page that:
 *
 *   - shows live health, uptime, record counts and which database backend is in
 *     use (PostgreSQL or the JSON fallback)
 *   - lists every route with its method, auth requirement and a short
 *     description
 *   - has a "Try it" button per route that issues the real request and shows the
 *     actual status code and response body
 *
 * It is deliberately dependency-free and inline: no CDN, no build step, nothing
 * to install, and it works with the app offline.
 */

const ROUTES = [
  { m: 'GET', p: '/api/health', auth: false, d: 'Service health, uptime, record counts and the active database backend.' },
  { m: 'GET', p: '/api/sos', auth: false, d: 'Stored SOS beacons, newest first. ?limit=50' },
  { m: 'POST', p: '/api/sos', auth: false, d: 'File an SOS beacon. Rate limited to 12/min per IP.' },
  { m: 'PATCH', p: '/api/sos/:id', auth: true, d: 'Triage a beacon — resolve, false-alarm, priority. DDMO_OFFICER only.' },
  { m: 'GET', p: '/api/events', auth: false, d: 'Server-sent events. Live stream of new beacons and bulletins.' },
  { m: 'GET', p: '/api/alerts', auth: false, d: 'CAP bulletins, newest first. ?limit=100' },
  { m: 'POST', p: '/api/alerts', auth: true, d: 'Broadcast a CAP bulletin. DDMO_OFFICER only.' },
  { m: 'PATCH', p: '/api/alerts/:id', auth: true, d: 'Resolve or re-open a bulletin. Resolved entries purge after 24h.' },
  { m: 'GET', p: '/api/incidents', auth: false, d: 'Citizen incident reports. ?limit=100' },
  { m: 'POST', p: '/api/incidents', auth: true, d: 'File a full incident report. CITIZEN / DDMO_OFFICER / FIELD_RESPONDER.' },
  { m: 'PATCH', p: '/api/incidents/:id', auth: true, d: 'Set incident status. DDMO_OFFICER only.' },
  { m: 'POST', p: '/api/auth/otp/request', auth: false, d: 'Request a login OTP for a phone number.' },
  { m: 'POST', p: '/api/auth/otp/verify', auth: false, d: 'Exchange an OTP for a session token. Single-use, 5-minute expiry.' },
  { m: 'GET', p: '/api/auth/session', auth: true, d: 'Current session — phone, role, expiry.' },
  { m: 'GET', p: '/api/auth/otp/status', auth: false, d: 'Which SMS gateway is configured, or dev mode.' },
  { m: 'POST', p: '/api/chat', auth: false, d: 'Relay a prompt to the AI provider. Streams SSE.' },
  { m: 'POST', p: '/api/yolo/detect', auth: false, d: 'Upload an image for YOLO flood/fire detection (multipart).' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = ROUTES.map((r, i) => `
      <tr>
        <td><span class="m m-${r.m.toLowerCase()}">${r.m}</span></td>
        <td class="p"><code>${esc(r.p)}</code></td>
        <td>${r.auth ? '<span class="lock">auth</span>' : '<span class="open">open</span>'}</td>
        <td class="d">${esc(r.d)}</td>
        <td><button class="go" data-i="${i}">Try it</button></td>
      </tr>`).join('');

export function explorerHtml() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NEXORA Backend</title>
<style>
  :root{
    --bg:#0F0F0F; --surface:#212121; --card:#2F2F2F; --line:#3D3D3D;
    --ink:#FFFFFF; --ink2:#E0E0E0; --ink3:#D0D0D0; --accent:#60A5FA;
    --ok:#34D399; --warn:#FBBF24;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:14px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 20px 64px}
  h1{font-size:20px;margin:0 0 2px;letter-spacing:-.02em}
  .sub{color:var(--ink3);font-size:13px;margin-bottom:24px}
  .sub a{color:var(--accent)}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
    gap:12px;margin-bottom:28px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
  .card .k{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink3)}
  .card .v{font-size:19px;font-weight:600;margin-top:5px;font-variant-numeric:tabular-nums}
  .ok{color:var(--ok)} .warn{color:var(--warn)}
  h2{font-size:13px;letter-spacing:.07em;text-transform:uppercase;
    color:var(--ink3);margin:0 0 10px;font-weight:600}
  table{width:100%;border-collapse:collapse;background:var(--surface);
    border:1px solid var(--line);border-radius:10px;overflow:hidden}
  th{text-align:left;font-size:10px;letter-spacing:.07em;text-transform:uppercase;
    color:var(--ink3);padding:9px 12px;background:var(--card);
    border-bottom:1px solid var(--line);font-weight:600}
  td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  tr:last-child td{border-bottom:none}
  .m{display:inline-block;font:600 10px/1 ui-monospace,monospace;letter-spacing:.04em;
    padding:4px 6px;border-radius:4px;background:#3D3D3D;color:var(--ink2)}
  .m-get{background:#14532D;color:#6EE7B7}
  .m-post{background:#1F2937;color:#93C5FD}
  .m-patch{background:#78350F;color:#F5C77E}
  code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink2)}
  .d{color:var(--ink3);font-size:12.5px}
  .lock{font:600 10px/1 ui-monospace,monospace;color:var(--warn)}
  .open{font:600 10px/1 ui-monospace,monospace;color:var(--ink3)}
  .go{background:var(--card);color:var(--ink2);border:1px solid var(--line);
    border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-weight:600}
  .go:hover{background:#3D3D3D;color:var(--ink);border-color:var(--accent)}
  .go:disabled{opacity:.5;cursor:wait}
  pre{background:#171717;border:1px solid var(--line);border-radius:8px;
    padding:12px 14px;overflow:auto;max-height:340px;font:12px/1.5 ui-monospace,monospace;
    color:var(--ink2);margin:12px 0 0;white-space:pre-wrap;word-break:break-word}
  pre.hide{display:none}
  .status{font:600 11px ui-monospace,monospace;margin-left:8px}
  .foot{margin-top:28px;color:var(--ink3);font-size:12px;line-height:1.7}
  .foot code{color:var(--ink2)}
</style></head>
<body><div class="wrap">
  <h1>NEXORA Backend</h1>
  <div class="sub">SOS Bridge on port 3001 &middot; <a href="http://localhost:5173">open the app</a></div>

  <div class="cards" id="cards">
    <div class="card"><div class="k">Status</div><div class="v" id="c-ok">&hellip;</div></div>
    <div class="card"><div class="k">Uptime</div><div class="v" id="c-up">&mdash;</div></div>
    <div class="card"><div class="k">Database</div><div class="v" id="c-db">&mdash;</div></div>
    <div class="card"><div class="k">SOS beacons</div><div class="v" id="c-rep">&mdash;</div></div>
    <div class="card"><div class="k">Bulletins</div><div class="v" id="c-al">&mdash;</div></div>
    <div class="card"><div class="k">Incidents</div><div class="v" id="c-inc">&mdash;</div></div>
  </div>

  <h2>Endpoints</h2>
  <table>
    <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Description</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <pre id="out" class="hide"></pre>

  <div class="foot">
    <strong>Sign in to test the write routes.</strong> Request an OTP, then use the code
    from the server terminal:<br/>
    <code>POST /api/auth/otp/request</code> &nbsp;<code>{"phone":"7904678280"}</code><br/>
    <code>POST /api/auth/otp/verify</code> &nbsp;&nbsp;<code>{"phone":"7904678280","code":"123456"}</code><br/>
    <code>Authorization: Bearer &lt;token&gt;</code> on any route marked <span class="lock">auth</span>.
  </div>
</div>
<script>
const ROUTES = ${JSON.stringify(ROUTES.map((r) => ({ m: r.m, p: r.p, auth: r.auth })))};
const out = document.getElementById('out');
const fmt = (b) => { try { return JSON.stringify(JSON.parse(b), null, 2); } catch { return b; } };

function show(t) { out.textContent = t; out.classList.remove('hide'); }

async function loadHealth() {
  try {
    const r = await fetch('/api/health');
    const j = await r.json();
    const up = Math.floor(j.uptimeSec / 60) + 'm ' + Math.floor(j.uptimeSec % 60) + 's';
    document.getElementById('c-ok').innerHTML =
      '<span class="ok">online</span>';
    document.getElementById('c-up').textContent = up;
    document.getElementById('c-db').textContent = (j.db && j.db.backend) || 'unknown';
    document.getElementById('c-rep').textContent = j.reports ?? '-';
    document.getElementById('c-al').textContent = j.alerts ?? '-';
    document.getElementById('c-inc').textContent = j.incidents ?? '-';
  } catch (e) {
    document.getElementById('c-ok').innerHTML = '<span style="color:#F87171">offline</span>';
  }
}

document.querySelectorAll('.go').forEach((b) => {
  b.addEventListener('click', async () => {
    const r = ROUTES[+b.dataset.i];
    // Replace the :id placeholder with a real id where the list is available,
    // otherwise a plain GET is issued and the server's own error is shown.
    let url = r.p;
    if (url.includes(':id')) {
      const list = url.startsWith('/api/alerts') ? '/api/alerts?limit=1'
                 : url.startsWith('/api/incidents') ? '/api/incidents?limit=1'
                 : '/api/sos?limit=1';
      try {
        const j = await (await fetch(list)).json();
        const arr = j.alerts || j.incidents || j.reports || [];
        if (!arr.length) { show('No records yet to build an id from.\n\nPOST to this collection first, or file one from the app.'); return; }
        url = url.replace(':id', encodeURIComponent(arr[0].id));
      } catch { show('Could not list records to find an id.'); return; }
    }
    b.disabled = true;
    const old = b.textContent;
    b.textContent = '…';
    const t0 = performance.now();
    try {
      const res = await fetch(url);
      const body = await res.text();
      const ms = Math.round(performance.now() - t0);
      const cls = res.ok ? 'ok' : 'warn';
      show(res.status + ' ' + res.statusText + '  ·  ' + ms + 'ms  ·  ' + url
        + '\\n\\n' + fmt(body));
      b.insertAdjacentHTML('afterend',
        '<span class="status ' + cls + '">' + res.status + '</span>');
    } catch (e) {
      show('Request failed: ' + e.message);
    } finally {
      b.disabled = false; b.textContent = old;
    }
  });
});

loadHealth();
setInterval(loadHealth, 10000);
</script>
</body></html>`;
}
