// Telegram webhook for the LogBook bot. Deployed with --no-verify-jwt: Telegram authenticates with the secret_token header instead.
import { handleUpdate, setupBot, teardownBot } from './bot.js';
import { flushPending, sameSecret, SUPABASE_URL } from '../_shared/bot_runtime.ts';

const SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/telegram-bot`;

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!sameSecret(request.headers.get('x-telegram-bot-api-secret-token'), SECRET)) {
    return new Response('forbidden', { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return new Response('bad request', { status: 400 });

  // Operator actions, guarded by the same secret: switch Telegram to this webhook or back to polling.
  if (body.action === 'setup') return Response.json(await setupBot(WEBHOOK_URL, SECRET));
  if (body.action === 'teardown') return Response.json(await teardownBot());

  try {
    await handleUpdate(body);
  } catch (error) {
    console.error('telegram update failed:', error);
  }
  // Answer only after every reply went out; a non-2xx status would make Telegram redeliver the update.
  await flushPending();
  return new Response('ok');
});
