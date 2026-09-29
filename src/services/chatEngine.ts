/**
 * chatEngine.ts — turns the live NEXORA store state into context the LLM can
 * answer from, plus the prompt contract and the [LOC:...] block parser that
 * rehydrates map / directions action buttons from a model reply.
 */
import { useNexoraStore } from '../store/useNexoraStore';
import { LANGUAGE_CONFIG, type SupportedLanguage } from '../i18n/translations';

export interface LocationAction {
  type: 'shelter' | 'hospital' | 'route' | 'map';
  title: string;
  lat?: number;
  lng?: number;
  address?: string;
  routeId?: string;
}

export interface ParsedReply {
  text: string;
  locationAction?: LocationAction;
}

const ACTIVE_SOS_STATUSES = ['PENDING', 'TRIAGED', 'DISPATCHED', 'COMMITTED'];

const HELPLINES = [
  'District Disaster Control Room: 1077',
  'State Emergency Operations Center (SEOC): 1070',
  'Police / National Emergency: 112',
  'Ambulance: 108',
  'Fire Rescue: 101',
].join(' | ');

/** Compact, authoritative snapshot of the live telemetry the bot can reference. */
export function buildLiveSnapshot(): string {
  const s = useNexoraStore.getState();
  const lines: string[] = [];

  lines.push(`District: ${s.district}`);
  lines.push(
    `Overall risk: ${s.overallRiskLevel} | River level: ${s.riverLevelMeters} m MSL | ` +
      `Danger mark: ${s.dangerMarkMeters} m | Rainfall: ${s.rainfallMmPerHour} mm/h | ` +
      `Wind: ${s.windSpeedKmh} km/h | Temp: ${s.temperatureC} C | Humidity: ${s.humidityPct}% | ` +
      `Embankment breached: ${s.embankmentBreached ? 'YES' : 'No'}`,
  );

  lines.push('SHELTERS:');
  s.shelters.forEach((sh) => {
    const free = Math.max(0, sh.totalCapacity - sh.currentOccupancy);
    lines.push(
      `- ${sh.name} (${sh.address}) [${sh.lat.toFixed(3)}, ${sh.lng.toFixed(3)}] | ` +
        `free ${free} / occupied ${sh.currentOccupancy} / reserved ${sh.reservedSpaces} | medical: ${sh.hasMedicalFacility ? 'yes' : 'no'} | ` +
        `food ${sh.resources.foodPackets} pkts, water ${sh.resources.waterLiters} L, med kits ${sh.resources.medicalKits}` +
        (sh.id ? ` | id ${sh.id}` : ''),
    );
  });

  lines.push('HOSPITALS:');
  s.hospitals.forEach((h) => {
    lines.push(
      `- ${h.name} (${h.address}) [${h.lat.toFixed(3)}, ${h.lng.toFixed(3)}] | ` +
        `${h.availableBeds} beds free (${h.icuBedsAvailable} ICU) | helpline ${h.contactEmergency}` +
        (h.id ? ` | id ${h.id}` : ''),
    );
  });

  const active = s.sosReports.filter((r) => ACTIVE_SOS_STATUSES.includes(r.status));
  lines.push(`ACTIVE INCIDENTS (${active.length}):`);
  active.forEach((r) => {
    lines.push(
      `- ${r.id} ${r.locationName} [${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}] | ` +
        `${r.peopleCount} people | water ${r.waterLevelMeters} m | priority ${r.priorityScore} ${r.priorityLevel} | ` +
        `needs ${(r.needs || []).join(', ')}`,
    );
  });

  lines.push('EVACUATION ROUTES:');
  s.evacuationRoutes.forEach((r) => {
    lines.push(
      `- ${r.id}: ${r.originName} -> ${r.destinationName} | ${r.distanceKm} km | ` +
        `${r.etaMinutes} min | ${r.riskRating}`,
    );
  });

  const roads = s.blockedRoads.filter((r) => r.active);
  if (roads.length) {
    lines.push('BLOCKED ROADS:');
    roads.forEach((r) => lines.push(`- ${r.name}: ${r.reason}`));
  }

  const alerts = s.alerts.filter((a) => a.active);
  if (alerts.length) {
    lines.push('ACTIVE ALERTS:');
    alerts.forEach((a) => lines.push(`- [${a.severity}] ${a.title} | ${a.zone} | ${a.reason} | action: ${a.recommendedAction}`));
  }

  lines.push(`HELPLINES: ${HELPLINES}`);

  return lines.join('\n');
}

function langLabel(lang: SupportedLanguage): string {
  return LANGUAGE_CONFIG[lang]?.nativeLabel || 'English';
}

/**
 * The system prompt that makes the model behave like a real conversational
 * assistant while staying accurate about the live situation.
 */
export function buildSystemPrompt(uiLanguage: SupportedLanguage, snapshot: string): string {
  return [
    `You are NEXORA AI — the official AI assistant of the NEXORA disaster-resilience and emergency-response platform, operated by the SEOC command cell.`,
    ``,
    `BEHAVIOR`,
    `- Chat naturally and conversationally — a calm, warm, expert assistant. For casual messages ("hi", "who are you", "thank you", small talk) reply briefly and naturally, never like a scripted kiosk.`,
    `- You can answer ANY question: general knowledge, explanations, definitions, calculations, writing/typing help, health & safety tips, and small talk — answer helpfully and concisely. You are a real AI assistant, not just a FAQ bot.`,
    `- When the user asks about THIS disaster / the app (risk, river level, shelters, hospitals, incidents, routes, supplies, alerts, helplines, evacuation), answer ONLY from the LIVE TELEMETRY provided below. Never invent numbers, names, addresses, or statistics. If the info is not in the telemetry, say you don't have it and suggest a related question you CAN answer.`,
    ``,
    `LANGUAGE`,
    `- Always reply in the same language the user just wrote or spoke (English, தமிழ், हिन्दी, తెలుగు, മലയാളം, বাংলা, or Romanized forms) — match their language and script.`,
    `- If the user's language is ambiguous, reply in the app's UI language: ${langLabel(uiLanguage)}.`,
    `- Keep the whole reply in that language (place names may stay as-is).`,
    ``,
    `FORMAT`,
    `- 2 to 6 sentences. Use "•" bullets for lists. No markdown tables, no code fences.`,
    `- Be direct and calm. Prioritize concrete guidance in life-safety situations.`,
    ``,
    `LOCATION BLOCKS (only when your answer references a place)`,
    `- Append EXACTLY ONE machine-readable block at the very END of your reply, on its own final line:`,
    `[LOC:{"type":"shelter|hospital|route|map","title":"Place name","address":"Street, City","lat":12.345,"lng":67.890,"routeId":"ROUTE-ID"}]`,
    `- type meanings:`,
    `  • shelter — a relief camp / shelter (include routeId when an evacuation route serves it)`,
    `  • hospital — a hospital (no routeId)`,
    `  • route — an evacuation route (always include routeId, and use the destination as the title)`,
    `  • map — any other location, e.g. an incident/SOS site (no routeId)`,
    `- Copy lat, lng, address and routeId EXACTLY from the LIVE TELEMETRY. Never guess coordinates.`,
    `- The block must be a single line of valid JSON. If no place is involved, do NOT add a block.`,
    ``,
    `LIVE TELEMETRY (authoritative — current snapshot):`,
    snapshot,
  ].join('\n');
}

/**
 * Extracts the [LOC:{"type":...}] block (if the model emitted one) from a reply,
 * returning the display text with the block removed plus the parsed action.
 */
export function extractLocationBlock(text: string): ParsedReply {
  const match = text.match(/\[LOC:(\{[\s\S]*?\})\]/);
  if (!match) return { text: text.trim() };

  const stripped = text.replace(match[0], '').trim();

  try {
    const data = JSON.parse(match[1]) as {
      type?: string;
      title?: string;
      address?: string;
      lat?: number | string;
      lng?: number | string;
      routeId?: string;
    };

    const action: LocationAction = {
      type:
        data.type === 'hospital' ? 'hospital'
        : data.type === 'route' ? 'route'
        : data.type === 'map' ? 'map'
        : 'shelter',
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Location',
      address: typeof data.address === 'string' && data.address.trim() ? data.address.trim() : undefined,
      lat: typeof data.lat === 'number' ? data.lat : undefined,
      lng: typeof data.lng === 'number' ? data.lng : undefined,
      routeId: typeof data.routeId === 'string' && data.routeId.trim() ? data.routeId.trim() : undefined,
    };

    return { text: stripped, locationAction: action };
  } catch {
    // Malformed block — drop it but keep the rest of the reply.
    return { text: stripped };
  }
}