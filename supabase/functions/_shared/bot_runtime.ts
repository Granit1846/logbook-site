// Runtime for the Telegram/MAX webhook bots: replaces the Node process's https, files and curl with fetch and the bot_state table.
const encoder = new TextEncoder();

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://zjagjauwmpuzcwzidhkn.supabase.co';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Bot code fires many requests without awaiting them; the webhook waits for all of them before answering,
// otherwise the runtime may stop the worker with replies still unsent.
const pending = new Set<Promise<unknown>>();
export function track<T>(promise: Promise<T>): Promise<T> {
  pending.add(promise);
  promise.finally(() => pending.delete(promise)).catch(() => {});
  return promise;
}
export async function flushPending(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending]);
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

export async function getBotToken(platform: 'telegram' | 'max'): Promise<string> {
  const configured = Deno.env.get(platform === 'max' ? 'MAX_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN');
  if (configured) return configured;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/logbook_platform_bot_token`, {
    method: 'POST',
    headers: serviceHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_platform: platform }),
  });
  const token = response.ok ? await response.json() as string | null : null;
  if (!token) throw new Error(`${platform} bot token is not configured`);
  return token;
}

// shortcut: whole-document read/modify/write without locking; fine for a few users, move to row tables if writes start to collide.
export async function loadState<T>(key: string, fallback: T): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/bot_state?key=eq.${encodeURIComponent(key)}&select=value`, {
    headers: serviceHeaders(),
  });
  if (!response.ok) {
    console.error('bot_state read failed:', key, response.status);
    return fallback;
  }
  const rows = await response.json() as Array<{ value: T }>;
  return rows[0]?.value ?? fallback;
}

export async function saveState(key: string, value: unknown): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/bot_state?on_conflict=key`, {
    method: 'POST',
    headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) console.error('bot_state write failed:', key, response.status);
}

// Read-modify-write with a version check: a write only succeeds if nobody changed the value since it was read,
// otherwise it re-reads and retries. Keeps fast, concurrently delivered button presses from losing input.
export async function updateState<T extends object>(key: string, fallback: T, mutate: (value: T) => T): Promise<T> {
  const url = `${SUPABASE_URL}/rest/v1/bot_state`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const read = await fetch(`${url}?key=eq.${encodeURIComponent(key)}&select=value`, { headers: serviceHeaders() });
    if (!read.ok) throw new Error(`bot_state read failed: ${read.status}`);
    const current = ((await read.json()) as Array<{ value: T & { v?: number } }>)[0]?.value;
    const version = Number(current?.v ?? 0);
    const next = { ...mutate(structuredClone(current ?? fallback)), v: version + 1 } as T & { v: number };
    const headers = serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' });
    const write = current
      ? await fetch(`${url}?key=eq.${encodeURIComponent(key)}&value->>v=${version ? `eq.${version}` : 'is.null'}`, {
          method: 'PATCH', headers, body: JSON.stringify({ value: next, updated_at: new Date().toISOString() }),
        })
      : await fetch(url, {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify({ key, value: next }),
        });
    if (write.ok && ((await write.json()) as unknown[]).length === 1) return next;
  }
  throw new Error(`bot_state busy: ${key}`);
}

async function hmacHex(key: string, value: string): Promise<string> {
  const imported = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(value)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function callPlatformAuth(body: Record<string, unknown>, publicKey: string): Promise<{ status: number; data: any }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/platform-auth`, {
    method: 'POST',
    headers: { apikey: publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

type CachedSession = { data: any; expiresAt: number };
const sessionCache = new Map<string, CachedSession>();

// Reuse a token until 5 minutes before its own expiry (exp claim of the access token JWT).
function sessionExpiry(accessToken: string): number {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (Number.isFinite(payload.exp)) return payload.exp * 1000 - 5 * 60 * 1000;
  } catch { /* fall through */ }
  return Date.now() + 30 * 60 * 1000;
}

// Same contract as bots/platform_session.js: a signed request proves the bot vouches for this messenger user.
// Every webhook call may start a fresh worker, so the session is also cached in bot_state (server-only table).
export async function getPlatformSession(platform: string, userId: unknown, botToken: string, publicKey: string): Promise<any> {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const cacheKey = `session_${platform}_${id}`;
  const cached = sessionCache.get(cacheKey) ?? await loadState<CachedSession | null>(cacheKey, null);
  if (cached && cached.expiresAt > Date.now()) {
    sessionCache.set(cacheKey, cached);
    return cached.data;
  }
  const timestamp = Date.now();
  const signature = await hmacHex(botToken, `bot_session\n${platform}\n${id}\n${timestamp}`);
  try {
    const { status, data } = await callPlatformAuth({ action: 'bot_session', platform, userId: id, timestamp, signature }, publicKey);
    if (status !== 200 || !data?.access_token) return null;
    const entry = { data, expiresAt: sessionExpiry(data.access_token) };
    sessionCache.set(cacheKey, entry);
    track(saveState(cacheKey, entry));
    return data;
  } catch {
    return null;
  }
}

export async function confirmPlatformCode(platform: string, userId: unknown, code: string, botToken: string, publicKey: string): Promise<boolean> {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0 || !/^auth_[a-z0-9_-]{8,64}$/i.test(code)) return false;
  const timestamp = Date.now();
  const signature = await hmacHex(botToken, `confirm_code\n${platform}\n${id}\n${code}\n${timestamp}`);
  try {
    const { status, data } = await callPlatformAuth({ action: 'confirm_code', platform, userId: id, code, timestamp, signature }, publicKey);
    return status === 200 && data?.ok === true;
  } catch {
    return false;
  }
}

// Constant-time comparison for the webhook secret header.
export function sameSecret(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected || given.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < given.length; i++) difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
