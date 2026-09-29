/**
 * directory.mjs — server-side role assignment (the officer roster).
 *
 * Before this existed, the OTP flow accepted whatever `role` the browser sent:
 *
 *   POST /api/auth/otp/request  { "phone": "...", "role": "DDMO_OFFICER" }
 *
 * …so anyone could request a DDMO officer session and then broadcast CAP
 * bulletins. The role must never be client-supplied — authority comes from the
 * server's own roster, not from a request body.
 *
 * Roster lives in server/officers.json (tracked config — NOT under
 * server/data/, which is gitignored runtime state) and is re-read on every
 * lookup, so edits apply without a restart:
 *
 *   {
 *     "officers": [
 *       { "phone": "9000000002", "name": "K. Iyer",  "role": "DDMO_OFFICER" },
 *       { "phone": "9000000003", "name": "R. Nair",  "role": "FIELD_RESPONDER" }
 *     ]
 *   }
 *
 * Add someone with:  npm run roster:add +919876543210 DDMO_OFFICER "Their Name"
 *
 * Anyone not on the roster signs in as CITIZEN. That is the safe default: an
 * unrecognised number can still raise an SOS and file an incident report, but
 * cannot broadcast alerts or triage the queue.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROSTER_FILE = join(__dirname, 'officers.json');

export const VALID_ROLES = ['CITIZEN', 'DDMO_OFFICER', 'FIELD_RESPONDER', 'SHELTER_MANAGER'];

/** Roles that may be granted to a phone number on the roster. */
const GRANTABLE = ['DDMO_OFFICER', 'FIELD_RESPONDER', 'SHELTER_MANAGER'];

const SEED = {
  officers: [
    { phone: '9000000002', name: 'Demo DDMO Officer', role: 'DDMO_OFFICER' },
    { phone: '9000000003', name: 'Demo Field Responder', role: 'FIELD_RESPONDER' },
    { phone: '9000000004', name: 'Demo Shelter Manager', role: 'SHELTER_MANAGER' },
  ],
};

const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10);

function load() {
  try {
    if (existsSync(ROSTER_FILE)) {
      const parsed = JSON.parse(readFileSync(ROSTER_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.officers)) return parsed.officers;
    }
  } catch (err) {
    console.warn('[directory] could not read officers.json:', err.message);
  }
  return null;
}

/** Write the seed roster on first run so the file is discoverable/editable. */
function ensureRoster() {
  if (load()) return;
  try {
    writeFileSync(ROSTER_FILE, JSON.stringify(SEED, null, 2));
    console.log(`[directory] seeded officer roster -> ${ROSTER_FILE}`);
  } catch (err) {
    console.warn('[directory] could not seed officers.json:', err.message);
  }
}

ensureRoster();

/**
 * Resolve the authoritative role for a phone number.
 * Unknown numbers are CITIZEN — never a privileged role.
 * @param {string} phone
 * @param {string} requestedRole ignored on purpose; kept only for logging
 */
export function resolveRole(phone, requestedRole) {
  const p = digits(phone);
  const officers = load() || SEED.officers;
  const match = officers.find((o) => digits(o.phone) === p);

  if (match && GRANTABLE.includes(match.role)) {
    if (requestedRole && requestedRole !== match.role) {
      console.warn(
        `[directory] +91 ${p} asked for role "${requestedRole}" but the roster `
        + `grants "${match.role}" — honouring the roster.`
      );
    }
    return { role: match.role, name: match.name || null, onRoster: true };
  }

  if (requestedRole && GRANTABLE.includes(requestedRole)) {
    console.warn(
      `[directory] +91 ${p} requested elevated role "${requestedRole}" but is not on `
      + `the roster — downgraded to CITIZEN.`
    );
  }
  return { role: 'CITIZEN', name: null, onRoster: false };
}

/** Roster contents, for an admin view. Never returns phone numbers in full. */
export function listOfficers() {
  const officers = load() || SEED.officers;
  return officers.map((o) => ({
    phoneMasked: `+91 ${digits(o.phone).slice(0, 3)}****${digits(o.phone).slice(-3)}`,
    name: o.name || null,
    role: o.role,
  }));
}
