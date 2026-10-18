// Validates signed Mini App launch data before issuing a one-time Supabase login token.
// ASVS V2/V3: identity is taken only from authenticated platform data; no password is exposed.
const allowedOrigins = new Set([
  'https://logbook-site-five.vercel.app',
  'https://logbook-telegram-app.vercel.app',
  // *.vercel.app is unreachable from Russian networks, so the MAX Mini App is also served from GitHub Pages.
  'https://granit1846.github.io',
]);

const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: Uint8Array, value: string | Uint8Array): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, typeof value === 'string' ? encoder.encode(value) : value));
}

function equalHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function parseSignedData(raw: string): { fields: Map<string, string>; checkString: string; hash: string } {
  if (!raw || raw.length > 8192) throw new Error('missing_launch_data');
  const fields = new Map<string, string>();
  for (const pair of raw.split('&')) {
    const separator = pair.indexOf('=');
    if (separator < 1) throw new Error('invalid_launch_data');
    const name = decodeURIComponent(pair.slice(0, separator));
    const value = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, ' '));
    if (fields.has(name)) throw new Error('duplicate_launch_field');
    fields.set(name, value);
  }
  const hash = fields.get('hash') ?? '';
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('invalid_launch_hash');
  const checkString = [...fields]
    .filter(([name]) => name !== 'hash')
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  return { fields, checkString, hash };
}

async function verifiedUserId(platform: string, raw: string): Promise<number> {
  const { fields, checkString, hash } = parseSignedData(raw);
  const token = await getBotToken(platform);
  if (!token) throw new Error('auth_not_configured');
  const secret = await hmac(encoder.encode('WebAppData'), token);
  const expected = hex(await hmac(secret, checkString));
  if (!equalHex(expected, hash)) throw new Error('invalid_signature');

  const authDate = Number(fields.get('auth_date'));
  const age = Date.now() / 1000 - authDate;
  if (!Number.isSafeInteger(authDate) || age < -60 || age > 3600) throw new Error('expired_launch_data');
  const user = JSON.parse(fields.get('user') ?? 'null') as { id?: unknown } | null;
  const id = Number(user?.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('missing_user');
  return id;
}

async function getBotToken(platform: string): Promise<string | null> {
  const configured = Deno.env.get(platform === 'max' ? 'MAX_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN');
  if (configured) return configured;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return null;
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/logbook_platform_bot_token`, {
    method: 'POST',
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_platform: platform }),
  });
  if (!response.ok) return null;
  return await response.json() as string | null;
}

function serviceCredentials(): { url: string; key: string } {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('auth_not_configured');
  return { url, key };
}

async function pilotIdFor(platform: string, platformId: number, url: string, key: string): Promise<number> {
  if (platform !== 'max') return platformId;
  const links = await fetch(`${url}/rest/v1/max_identity_links?max_user_id=eq.${platformId}&select=telegram_user_id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!links.ok) throw new Error('auth_unavailable');
  const rows = await links.json() as Array<{ telegram_user_id: number }>;
  return Number(rows[0]?.telegram_user_id) || (platformId === 252125236 ? 891159880 : platformId);
}

async function issueTokenHash(email: string, url: string, key: string): Promise<string> {
  return (await generateLink(email, url, key)).tokenHash;
}

async function generateLink(email: string, url: string, key: string): Promise<{ tokenHash: string; userId: string }> {
  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  if (!response.ok) throw new Error('auth_unavailable');
  const result = await response.json();
  const tokenHash = result?.hashed_token ?? result?.properties?.hashed_token;
  const userId = result?.id ?? result?.user?.id;
  if (typeof tokenHash !== 'string' || !tokenHash || typeof userId !== 'string') throw new Error('auth_unavailable');
  return { tokenHash, userId };
}

async function botSession(body: Record<string, unknown>): Promise<Response> {
  const platform = body.platform;
  const id = Number(body.userId);
  const timestamp = Number(body.timestamp);
  const signature = body.signature;
  if ((platform !== 'max' && platform !== 'telegram') ||
    !Number.isSafeInteger(id) || id <= 0 ||
    !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 60000 ||
    typeof signature !== 'string') throw new Error('invalid_bot_request');
  const token = await getBotToken(platform);
  if (!token) throw new Error('auth_not_configured');
  const expected = hex(await hmac(encoder.encode(token), `bot_session\n${platform}\n${id}\n${timestamp}`));
  if (!equalHex(expected, signature)) throw new Error('invalid_signature');
  const { url, key } = serviceCredentials();
  const pilotId = await pilotIdFor(platform, id, url, key);
  const tokenHash = await issueTokenHash(`tg_${pilotId}@telegram.logbook`, url, key);
  const response = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_hash: tokenHash, type: 'email' }),
  });
  if (!response.ok) throw new Error('auth_unavailable');
  const data = await response.json();
  if (typeof data?.access_token !== 'string') throw new Error('auth_unavailable');
  return new Response(JSON.stringify({ access_token: data.access_token, pilot_id: pilotId }));
}

async function confirmCode(body: Record<string, unknown>): Promise<Response> {
  const platform = body.platform;
  const id = Number(body.userId);
  const code = body.code;
  const timestamp = Number(body.timestamp);
  const signature = body.signature;
  if ((platform !== 'max' && platform !== 'telegram') ||
    !Number.isSafeInteger(id) || id <= 0 ||
    typeof code !== 'string' || !/^auth_[a-z0-9_-]{8,64}$/i.test(code) ||
    !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 60000 ||
    typeof signature !== 'string') throw new Error('invalid_confirm_request');
  const token = await getBotToken(platform);
  if (!token) throw new Error('auth_not_configured');
  const expected = hex(await hmac(encoder.encode(token), `confirm_code\n${platform}\n${id}\n${code}\n${timestamp}`));
  if (!equalHex(expected, signature)) throw new Error('invalid_signature');
  const { url, key } = serviceCredentials();
  const pilotId = await pilotIdFor(platform, id, url, key);
  const response = await fetch(`${url}/rest/v1/rpc/logbook_telegram_confirm_auth`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: code, p_telegram_id: pilotId, p_first_name: '', p_username: '' }),
  });
  if (!response.ok) throw new Error('auth_unavailable');
  const result = await response.json();
  if (result?.ok !== true) throw new Error('code_not_found');
  return new Response('{"ok":true}');
}

async function sha256Hex(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

function randomHex(bytes: number): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

// Android/desktop login: the app gets a code for the bot link plus a secret that only it knows.
// With link=true the signed-in email account becomes the email alias of the bot account once confirmed.
async function startCode(request: Request, link: boolean): Promise<Response> {
  const { url, key } = serviceCredentials();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  let linkUserId: string | null = null;
  if (link) {
    const { user } = await signedInUser(request, url, key);
    if (/@telegram\.logbook$/.test(user.email ?? '')) throw new Error('not_email_account');
    linkUserId = user.id;
  }
  const endpoint = `${url}/rest/v1/telegram_auth_sessions`;
  const stale = new Date(Date.now() - 600000).toISOString();
  await fetch(`${endpoint}?created_at=lt.${encodeURIComponent(stale)}`, { method: 'DELETE', headers });
  const code = `auth_${randomHex(12)}`;
  const secret = randomHex(32);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ code, status: 'pending', poll_hash: await sha256Hex(secret), link_user_id: linkUserId }),
  });
  if (!response.ok) throw new Error('auth_unavailable');
  return new Response(JSON.stringify({ code, secret }));
}

async function pollCode(body: Record<string, unknown>): Promise<Response> {
  const code = body.code;
  const secret = body.secret;
  if (typeof code !== 'string' || !/^auth_[a-f0-9]{24}$/.test(code) ||
    typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret)) throw new Error('invalid_poll_request');
  const { url, key } = serviceCredentials();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const since = new Date(Date.now() - 600000).toISOString();
  const filter = `${url}/rest/v1/telegram_auth_sessions?code=eq.${code}&poll_hash=eq.${await sha256Hex(secret)}&created_at=gte.${encodeURIComponent(since)}`;
  // Deleting the confirmed row makes the code single-use even if two polls race.
  const taken = await fetch(`${filter}&status=eq.confirmed&select=auth_email,link_user_id`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=representation' },
  });
  if (!taken.ok) throw new Error('auth_unavailable');
  const row = ((await taken.json()) as Array<{ auth_email?: string; link_user_id?: string | null }>)[0];
  if (row?.auth_email) {
    const { tokenHash, userId } = await generateLink(row.auth_email, url, key);
    if (row.link_user_id) await attachAlias(row.link_user_id, userId, url, key);
    return new Response(JSON.stringify({ status: 'confirmed', tokenHash }));
  }
  const pending = await fetch(`${filter}&select=status`, { headers });
  if (!pending.ok) throw new Error('auth_unavailable');
  if (((await pending.json()) as unknown[]).length === 0) throw new Error('code_not_found');
  return new Response('{"status":"pending"}');
}

async function updateMaxLink(body: Record<string, unknown>): Promise<Response> {
  const action = body.action;
  const maxId = Number(body.maxId);
  const tgId = Number(body.tgId);
  const timestamp = Number(body.timestamp);
  const signature = body.signature;
  if ((action !== 'link' && action !== 'unlink') ||
    !Number.isSafeInteger(maxId) || maxId <= 0 ||
    !Number.isSafeInteger(tgId) || (action === 'link' ? tgId <= 0 : tgId !== 0) ||
    !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 60000 ||
    typeof signature !== 'string') throw new Error('invalid_link_request');
  const token = await getBotToken('max');
  if (!token) throw new Error('auth_not_configured');
  const expected = hex(await hmac(encoder.encode(token), `${action}\n${maxId}\n${tgId}\n${timestamp}`));
  if (!equalHex(expected, signature)) throw new Error('invalid_signature');
  const { url, key } = serviceCredentials();
  const endpoint = `${url}/rest/v1/max_identity_links`;
  const response = await fetch(action === 'link'
    ? `${endpoint}?on_conflict=max_user_id`
    : `${endpoint}?max_user_id=eq.${maxId}`, {
    method: action === 'link' ? 'POST' : 'DELETE',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: action === 'link' ? JSON.stringify({ max_user_id: maxId, telegram_user_id: tgId }) : undefined,
  });
  if (!response.ok) throw new Error('link_unavailable');
  return new Response('{"ok":true}');
}

async function signedInUser(request: Request, url: string, key: string): Promise<{ token: string; user: Record<string, any> }> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('not_signed_in');
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('not_signed_in');
  return { token, user: await response.json() };
}

// Email login for bot accounts: a separate Auth user (the alias) holds the email and the password hash,
// so the tg_<id>@telegram.logbook account and every pilotId derived from it stay unchanged.
async function linkEmail(request: Request, body: Record<string, unknown>): Promise<Response> {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@telegram.logbook') ||
    typeof password !== 'string' || password.length < 6 || password.length > 72) throw new Error('invalid_link_email');
  const { url, key } = serviceCredentials();
  const { user } = await signedInUser(request, url, key);
  if (!/^tg_\d+@telegram\.logbook$/.test(user.email ?? '')) throw new Error('not_bot_account');
  const admin = `${url}/auth/v1/admin/users`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  // shortcut: the address is not confirmed by a letter (same as before); add a confirmation step if squatting becomes a problem.
  const fields = JSON.stringify({ email, password, email_confirm: true, app_metadata: { alias_of: user.id } });
  const aliasId = user.app_metadata?.email_alias_id;
  let response = typeof aliasId === 'string'
    ? await fetch(`${admin}/${aliasId}`, { method: 'PUT', headers, body: fields })
    : null;
  if (!response || response.status === 404) response = await fetch(admin, { method: 'POST', headers, body: fields });
  if (response.status === 422) {
    // A separate email account the user registered earlier: knowing its password lets it become the alias.
    const owned = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers, body: JSON.stringify({ email, password }),
    });
    if (owned.ok) {
      const session = await owned.json();
      await fetch(`${url}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${session.access_token}` } });
      response = await fetch(`${admin}/${session.user.id}`, { method: 'PUT', headers, body: fields });
    }
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(result?.error_code ?? result?.code ?? '');
    throw new Error(code === 'weak_password' ? 'weak_password' : response.status === 422 ? 'email_taken' : 'auth_unavailable');
  }
  const linked = await fetch(`${admin}/${user.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ app_metadata: { email_alias_id: result.id }, user_metadata: { linked_email: email } }),
  });
  if (!linked.ok) throw new Error('auth_unavailable');
  return new Response('{"ok":true}');
}

// Same pointers as linkEmail, for an email account that already has its own password.
async function attachAlias(aliasId: string, accountId: string, url: string, key: string): Promise<void> {
  const admin = `${url}/auth/v1/admin/users`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const alias = await fetch(`${admin}/${aliasId}`, {
    method: 'PUT', headers, body: JSON.stringify({ app_metadata: { alias_of: accountId } }),
  });
  if (!alias.ok) throw new Error('auth_unavailable');
  const email = (await alias.json())?.email;
  const account = await fetch(`${admin}/${accountId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ app_metadata: { email_alias_id: aliasId }, user_metadata: { linked_email: email } }),
  });
  if (!account.ok) throw new Error('auth_unavailable');
}

// Supabase Auth has already checked the alias password; trade that session for the bot account.
async function aliasSession(request: Request): Promise<Response> {
  const { url, key } = serviceCredentials();
  const { token, user } = await signedInUser(request, url, key);
  const ownerId = user.app_metadata?.alias_of;
  if (typeof ownerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error('not_email_alias');
  const owner = await fetch(`${url}/auth/v1/admin/users/${ownerId}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!owner.ok) throw new Error('not_email_alias');
  const account = await owner.json();
  // An alias replaced by a later relink must no longer open the account.
  if (account?.app_metadata?.email_alias_id !== user.id || typeof account.email !== 'string') throw new Error('not_email_alias');
  await fetch(`${url}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}` } });
  return new Response(JSON.stringify({ tokenHash: await issueTokenHash(account.email, url, key) }));
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? '';
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (origin && !allowedOrigins.has(origin)) return new Response('{"error":"origin_not_allowed"}', { status: 403, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response('{"error":"method_not_allowed"}', { status: 405, headers });

  try {
    const body = await request.text();
    if (body.length > 10000) throw new Error('invalid_request');
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed.action === 'link' || parsed.action === 'unlink') {
      const result = await updateMaxLink(parsed);
      return new Response(result.body, { headers });
    }
    if (parsed.action === 'bot_session') {
      const result = await botSession(parsed);
      return new Response(result.body, { headers });
    }
    if (parsed.action === 'confirm_code') {
      const result = await confirmCode(parsed);
      return new Response(result.body, { headers });
    }
    if (parsed.action === 'start_code') {
      const result = await startCode(request, parsed.link === true);
      return new Response(result.body, { headers });
    }
    if (parsed.action === 'poll_code') {
      const result = await pollCode(parsed);
      return new Response(result.body, { headers });
    }
    if (parsed.action === 'link_email') {
      const result = await linkEmail(request, parsed);
      return new Response(result.body, { headers });
    }
    if (parsed.action === 'alias_session') {
      const result = await aliasSession(request);
      return new Response(result.body, { headers });
    }
    const { platform, initData } = parsed;
    if ((platform !== 'max' && platform !== 'telegram') || typeof initData !== 'string') throw new Error('invalid_request');
    const platformId = await verifiedUserId(platform, initData);
    const { url: supabaseUrl, key: serviceKey } = serviceCredentials();
    const pilotId = await pilotIdFor(platform, platformId, supabaseUrl, serviceKey);
    const email = `tg_${pilotId}@telegram.logbook`;
    const tokenHash = await issueTokenHash(email, supabaseUrl, serviceKey);
    return new Response(JSON.stringify({ tokenHash }), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'auth_unavailable';
    const status = message === 'not_signed_in' ? 401 : message === 'email_taken' ? 409 : message === 'auth_not_configured' || message === 'auth_unavailable' || message === 'link_unavailable' ? 503 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
