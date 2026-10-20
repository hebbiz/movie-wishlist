import { createClient } from '@supabase/supabase-js';
import { discoverMedia } from '../lib/media-advice-service.mjs';
import { createKinobazaResolver } from '../lib/kinobaza-resolver.mjs';
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const reply = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export function createMediaAdviceHandler({ client, env, run = discoverMedia, fetchImpl = fetch, resolver } = {}) {
  return async request => {
    if (request.method !== 'POST') return reply(405, { status: 'method-not-allowed' });
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return reply(403, { status: 'origin-denied' });
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '') || Number(request.headers.get('content-length')) > 4096) return reply(400, { status: 'invalid-request' });
    let data;
    try {
      const reader = request.body?.getReader(); if (!reader) throw Error();
      const chunks = []; let bytes = 0;
      for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 4096) { await reader.cancel(); throw Error(); } chunks.push(part.value); }
      data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes)));
    } catch { return reply(400, { status: 'invalid-request' }); }
    if (!['capability', 'discover'].includes(data?.action) || !uuid(data.groupId) || !uuid(data.formSession) ||
      !/^tt\d{7,10}$/.test(data.imdbId ?? '') || data.listId !== null && data.listId !== undefined && !uuid(data.listId)) return reply(400, { status: 'invalid-context' });
    const token = /^Bearer ([^\s]{1,8192})$/.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return reply(401, { status: 'authentication-required' });
    try {
      const db = client ?? createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.any([AbortSignal.timeout(8_000), init.signal].filter(Boolean)) }) },
      });
      const { data: auth, error } = await db.auth.getUser(token);
      if (error || !auth?.user?.id || auth.user.is_anonymous) return reply(401, { status: 'authentication-required' });
      const args = { p_user: auth.user.id, p_group: data.groupId, p_imdb: data.imdbId, p_list: data.listId ?? null, p_form: data.formSession };
      const rpc = async (p_op, extra = {}) => {
        const { data: result, error } = await db.rpc('media_advice_action', { ...args, p_op, ...extra });
        if (error || !result) throw Error('access-or-budget-denied');
        return result;
      };
      if (data.action === 'capability') return reply(200, await rpc('capability'));
      const session = await rpc('start');
      const deadline = AbortSignal.timeout(55_000);
      const result = await run({ imdbId: data.imdbId, tmdbToken: env('TMDB_READ_ACCESS_TOKEN'), motnKey: env('MOTN_API_KEY'),
        reserve: stage => rpc('reserve', { p_session: session.id, p_stage: stage }), fetchImpl, resolver, signal: deadline });
      const receipt = await rpc('finish', { p_session: session.id }); // Revocation suppresses late results too.
      result.metrics ??= {};
      result.metrics.ledgerReservations = Array.isArray(receipt.attempts) ? receipt.attempts.length : null;
      const serialized = JSON.stringify(result);
      if (['SUPABASE_SERVICE_ROLE_KEY', 'TMDB_READ_ACCESS_TOKEN', 'MOTN_API_KEY', 'BRAVE_SEARCH_API_KEY'].map(env).filter(Boolean).some(secret => serialized.includes(secret))) return reply(502, { status: 'unsafe-source-content-withheld' });
      return reply(200, { result });
    } catch { return reply(403, { status: 'access-session-or-budget-unavailable', accounting: 'attempts-may-have-been-spent-no-retry' }); }
  };
}
const env = key => globalThis.Netlify?.env.get(key) ?? process.env[key] ?? '';
export default createMediaAdviceHandler({ env, resolver: createKinobazaResolver({ apiKey: env('BRAVE_SEARCH_API_KEY') }) });
