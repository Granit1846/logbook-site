// MAX webhook for the LogBook bot. Deployed with --no-verify-jwt; MAX authenticates with the secret carried in the subscribed URL (?s=).
import { handleMaxEvent, setupBot, teardownBot } from './bot.js';
import { flushPending, sameSecret, SUPABASE_URL } from '../_shared/bot_runtime.ts';

const SECRET = Deno.env.get('MAX_WEBHOOK_SECRET');

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!sameSecret(new URL(request.url).searchParams.get('s'), SECRET)) {
    return new Response('forbidden', { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return new Response('bad request', { status: 400 });

  // Operator actions, guarded by the same secret: subscribe MAX to this webhook or unsubscribe it.
  const webhookUrl = `${SUPABASE_URL}/functions/v1/max-bot?s=${SECRET}`;
  if (body.action === 'setup') return Response.json(await setupBot(webhookUrl));
  if (body.action === 'teardown') return Response.json(await teardownBot(webhookUrl));

  try {
    await handleMaxEvent(body);
  } catch (error) {
    console.error('max update failed:', error);
  }
  // Answer only after every reply went out, so the worker is not stopped mid-send.
  await flushPending();
  return new Response('ok');
});
