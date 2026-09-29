/**
 * llmService.ts — OpenAI-compatible Chat Completions client for the NEXORA AI assistant.
 *
 * CHANNELS (tried in order until one answers):
 *   1. Your own endpoint — if you configured VITE_CHAT_API_URL/KEY/MODEL
 *      (env) or nexora_chat_url/key/model (localStorage).
 *   2. NEXORA relay — POST /api/chat on the bundled Node backend
 *      (server/sos-server.mjs). The backend forwards to the free provider
 *      server-side, which avoids the provider's browser bot-check (a browser
 *      sending a foreign Origin gets 403 "Missing Turnstile token" — that is
 *      why the chatbot previously showed as OFFLINE). No API key needed.
 *   3. Direct free provider — last resort (only succeeds for non-browser
 *      contexts; harmless to attempt).
 *
 * Reliability: every channel retries SSE streaming once (cold-start recovery)
 * and then falls back to a plain non-streaming request before moving on.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatConfig {
  url: string;
  apiKey: string;
  model: string;
}

export interface StreamChatOptions {
  /** AbortController used by the caller to stop generation mid-stream. */
  signal?: AbortSignal;
  /** Called for every streamed content token (visible answer text only, never reasoning). */
  onToken?: (delta: string) => void;
}

const DEFAULT_URL = 'https://text.pollinations.ai/openai';
const DEFAULT_MODEL = 'openai';
const MAX_TOKENS = 700; // bound reply length -> faster first token, cleaner UI

/** Same-origin base for the backend bridge (Vite proxies /api -> :3001). */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';
const RELAY_URL = `${API_BASE}/api/chat`;

/** Cached connectivity state, so the UI can show "AI Online / Offline". */
let providerOk: boolean | null = null;
/** Human-readable reason for the last total failure (for the UI notice). */
let lastAiError: string | null = null;

/** null = not checked yet, true = online, false = last call failed. */
export function isAiOnline(): boolean | null {
  return providerOk;
}

/** Reason the AI was unreachable the last time (null when it worked). */
export function getLastAiError(): string | null {
  return lastAiError;
}

type Channel =
  | { kind: 'relay'; url: string }
  | { kind: 'direct'; url: string; apiKey: string; model: string };

function buildChannels(): Channel[] {
  const cfg = getChatConfig();
  const custom = cfg.url !== DEFAULT_URL || !!cfg.apiKey;
  const channels: Channel[] = [];
  if (custom) {
    channels.push({ kind: 'direct', url: cfg.url, apiKey: cfg.apiKey, model: cfg.model });
  }
  if (RELAY_URL) {
    channels.push({ kind: 'relay', url: RELAY_URL });
  }
  if (!custom || cfg.url !== DEFAULT_URL) {
    channels.push({ kind: 'direct', url: DEFAULT_URL, apiKey: '', model: DEFAULT_MODEL });
  }
  return channels;
}

function channelLabel(ch: Channel): string {
  return ch.kind === 'relay' ? 'backend relay' : ch.url;
}

/**
 * Cheap request (sent when the app loads / the chat opens) so a cold model is
 * warmed up and the user's first real question answers fast.
 */
export async function warmUpProvider(): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  for (const ch of buildChannels()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const ok = await requestChannel(ch, [{ role: 'user', content: 'ping' }], false, 5, controller.signal);
      clearTimeout(timer);
      if (ok.trim()) {
        providerOk = true;
        lastAiError = null;
        return true;
      }
    } catch {
      clearTimeout(timer);
      // try the next channel
    }
  }
  providerOk = false;
  return false;
}

function readStorage(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getChatConfig(): ChatConfig {
  const env = import.meta.env as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    url: str(env.VITE_CHAT_API_URL) || readStorage('nexora_chat_url') || DEFAULT_URL,
    apiKey: str(env.VITE_CHAT_API_KEY) || readStorage('nexora_chat_key') || '',
    model: str(env.VITE_CHAT_MODEL) || readStorage('nexora_chat_model') || DEFAULT_MODEL,
  };
}

/** True when running against the free, no-key default provider (via relay). */
export function isUsingFreeEndpoint(): boolean {
  const cfg = getChatConfig();
  return cfg.url.includes('pollinations.ai') && !cfg.apiKey;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: { content?: string; reasoning?: string };
    message?: { content?: string };
  }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One HTTP round-trip to a channel; resolves to the full assistant text. */
async function requestChannel(
  ch: Channel,
  messages: ChatMessage[],
  stream: boolean,
  maxTokens: number,
  signal: AbortSignal,
  onToken?: (token: string) => void,
): Promise<string> {
  const body = { model: ch.kind === 'direct' ? ch.model : DEFAULT_MODEL, messages, stream, temperature: 0.7, max_tokens: maxTokens };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ch.kind === 'direct' && ch.apiKey) headers.Authorization = `Bearer ${ch.apiKey}`;

  const res = await fetch(ch.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    // Surface the provider's real reason (e.g. "busy / queue full") with the
    // HTTP status attached so the caller can retry busy responses patiently.
    let detail = '';
    try {
      const j = (await res.json()) as { error?: string; detail?: string };
      detail = [j?.error, j?.detail].filter(Boolean).join(' — ').slice(0, 160);
    } catch {
      // body was not JSON — keep the generic message
    }
    const err = new Error(
      `HTTP ${res.status} (${channelLabel(ch)})${detail ? ` — ${detail}` : ''}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  if (!stream) {
    const json = (await res.json().catch(() => null)) as ChatCompletionChunk | null;
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text.trim()) return text;
    throw new Error(`EMPTY_RESPONSE (${channelLabel(ch)})`);
  }

  if (!res.body) throw new Error(`NO_STREAM_SUPPORT (${channelLabel(ch)})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as ChatCompletionChunk;
        const content = json.choices?.[0]?.delta?.content;
        if (typeof content === 'string' && content.length > 0) {
          full += content;
          onToken?.(content);
        }
      } catch {
        // Ignore malformed keep-alive frames.
      }
    }
  }

  if (full.trim()) return full;
  throw new Error(`EMPTY_STREAM (${channelLabel(ch)})`);
}

/**
 * Streams a chat completion from the best available channel and resolves to
 * the full assistant text. Tries: custom endpoint -> backend relay -> free
 * provider, with SSE retry + non-streaming fallback per channel.
 * - Resolves `null` if the generation was aborted (user pressed "Stop").
 * - Throws only when every channel failed (see getLastAiError() for why).
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  opts: StreamChatOptions = {},
): Promise<string | null> {
  // All channels share one controller so "Stop" works everywhere.
  const controller = new AbortController();
  const linkAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', linkAbort);
  const detachAbort = () => opts.signal?.removeEventListener('abort', linkAbort);

  const failures: string[] = [];
  let full = '';
  const flush = (token: string) => {
    full += token;
    opts.onToken?.(token);
  };

  for (const ch of buildChannels()) {
    // 1) + 2) streaming, with retries — busy providers (429/503) get a
    // longer, escalating backoff instead of being treated as "offline"
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const text = await requestChannel(ch, messages, true, MAX_TOKENS, controller.signal, flush);
        providerOk = true;
        lastAiError = null;
        detachAbort();
        return text;
      } catch (err) {
        if (isAbortError(err)) {
          detachAbort();
          return full || null; // user stopped mid-stream
        }
        const status = (err as { status?: number }).status;
        const busy = status === 429 || status === 503 || /busy|rate|queue/i.test(String(err));
        if (attempt < 3 && !opts.signal?.aborted) {
          await sleep((busy ? 2000 : 1200) * attempt); // escalating backoff
          continue;
        }
        failures.push(err instanceof Error ? err.message : String(err));
        break;
      }
    }

    // 3) non-streaming fallback for this channel
    if (!opts.signal?.aborted) {
      try {
        const text = await requestChannel(ch, messages, false, MAX_TOKENS, controller.signal, flush);
        providerOk = true;
        lastAiError = null;
        detachAbort();
        return text;
      } catch (err) {
        if (isAbortError(err)) {
          detachAbort();
          return full || null;
        }
        const status = (err as { status?: number }).status;
        const busy = status === 429 || status === 503 || /busy|rate|queue/i.test(String(err));
        if (busy && !opts.signal?.aborted) {
          // One more patient attempt before giving up — busy usually clears
          // within a couple of seconds once the queue drains.
          try {
            await sleep(2500);
            const text = await requestChannel(ch, messages, false, MAX_TOKENS, controller.signal, flush);
            providerOk = true;
            lastAiError = null;
            detachAbort();
            return text;
          } catch (err2) {
            if (isAbortError(err2)) {
              detachAbort();
              return full || null;
            }
            failures.push(err2 instanceof Error ? err2.message : String(err2));
          }
        } else {
          failures.push(err instanceof Error ? err.message : String(err));
        }
      }
    }
  }

  providerOk = false;
  lastAiError = failures[0] || 'all AI channels failed';
  detachAbort();
  const err = new Error(lastAiError);
  (err as Error & { channels?: string[] }).channels = failures;
  throw err;
}