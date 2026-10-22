import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeadline, HandlerDeadline } from '../netlify/lib/media-advice-deadline.mjs';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';

function clock() {
  let time = 0, id = 0; const timers = new Map();
  return { options: { now: () => time, setTimer: (f, ms) => { timers.set(++id, { f, at: time + ms }); return id; }, clearTimer: id => timers.delete(id) },
    advance(ms) { time += ms; for (const [id, t] of timers) if (t.at <= time) { timers.delete(id); t.f(); } },
    next: () => Math.min(...[...timers.values()].map(t => t.at - time)), now: () => time, count: () => timers.size };
}
const drain = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const request = () => new Request('https://app.example/.netlify/functions/media-advice', { method: 'POST', headers: { origin: 'https://app.example', authorization: 'Bearer AUTHORED', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'discover', groupId: '00000000-0000-4000-8000-000000000001', formSession: '00000000-0000-4000-8000-000000000002', imdbId: 'tt1234567' }) });

test('one entry deadline charges Auth/start, caps source work at remaining time, reserves finish/response', async () => {
  const c = clock(), operations = []; let sourceSignal;
  const client = { auth: { getUser: async () => { c.advance(7000); return { data: { user: { id: 'authored' } } }; } },
    rpc: async (_, args) => { operations.push(args.p_op); if (args.p_op === 'start') c.advance(7000); return { data: { id: 'authored', attempts: ['tmdb-find'] } }; } };
  const handler = createMediaAdviceHandler({ client, env: () => '', deadlineOptions: c.options,
    run: async ({ signal, reserve }) => { sourceSignal = signal; await reserve('tmdb-find'); return new Promise(() => {}); } });
  const pending = handler(request()); await drain();
  assert.equal(c.now(), 14000); assert.equal(c.next(), 31000); // NOT a new 55s after Auth/start.
  c.advance(31000); await drain(); const response = await pending;
  assert.equal(response.status, 504); assert.equal(sourceSignal.aborted, true);
  assert.deepEqual(operations, ['start', 'reserve', 'finish']);
  assert.match(await response.text(), /attempts-may-have-been-spent-no-retry/);
  assert.equal(c.count(), 0);
});
test('Auth, reservation and finish hangs are bounded; failed finish never returns source rows or retries', async () => {
  for (const phase of ['auth', 'reserve', 'finish']) {
    const c = clock(), calls = []; let sourceCalls = 0;
    const client = { auth: { getUser: async () => phase === 'auth' ? new Promise(() => {}) : { data: { user: { id: 'authored' } } } },
      rpc: async (_, args) => { calls.push(args.p_op); return args.p_op === phase ? new Promise(() => {}) : { data: { id: 's' } }; } };
    const pending = createMediaAdviceHandler({ client, env: () => '', deadlineOptions: c.options, run: async ({ reserve }) => {
      await reserve('tmdb-find'); sourceCalls++; return { rows: [{ secret: 'withhold-me' }] };
    } })(request()); await drain();
    c.advance(8000); await drain(); const r = await pending;
    assert.equal(r.status, 504, phase); assert.doesNotMatch(await r.text(), /withhold-me/);
    assert.equal(calls.filter(op => op === 'finish').length, phase === 'auth' ? 0 : 1);
    assert.equal(sourceCalls, phase === 'finish' ? 1 : 0); assert.equal(c.count(), 0);
  }
});
test('finish window ends at 53s from entry, not 8s after arbitrary late work; expired operations never dispatch', async () => {
  const c = clock(), d = createDeadline(c.options); c.advance(50000);
  const pending = d.wait(() => new Promise(() => {}), { finish: true });
  assert.equal(c.next(), 3000); c.advance(3000); await assert.rejects(pending, HandlerDeadline);
  let calls = 0; await assert.rejects(d.wait(() => calls++), HandlerDeadline); assert.equal(calls, 0);
});

test('real SDK Auth body wait is deadline bounded and aborts even after HTTP headers arrive', async () => {
  const c = clock(); let networkSignal, calls = 0;
  const pending = createMediaAdviceHandler({ env: key => ({ SUPABASE_URL: 'https://auth.example', SUPABASE_SERVICE_ROLE_KEY: 'AUTHORED-KEY' })[key] ?? '', deadlineOptions: c.options,
    fetchImpl: async (_, init) => { calls++; networkSignal = init.signal; return new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } }); },
    run: async () => { throw Error('source must not start'); },
  })(request());
  await drain(); assert.equal(calls, 1); c.advance(8000); await drain();
  assert.equal((await pending).status, 504); assert.equal(networkSignal.aborted, true); assert.equal(calls, 1);
});

test('Tavily search inherits the handler entry deadline and still leaves one bounded finish', async () => {
  const c = clock(), ops = []; let sourceSignal, searches = 0;
  const client = { auth: { getUser: async () => { c.advance(7000); return { data: { user: { id: 'authored' } } }; } },
    rpc: async (_, args) => { ops.push(args.p_op); if (args.p_op === 'start') c.advance(7000); return { data: { id: 'authored' } }; } };
  const resolver = createKinobazaResolver({ apiKey: 'AUTHORED_TAVILY_KEY' });
  const pending = createMediaAdviceHandler({ client, env: () => '', deadlineOptions: c.options,
    run: async ({ signal, reserve, fetchImpl }) => resolver({ originalTitle: 'Authored film', year: 2001 },
      { signal, reserve, fetchImpl, calls: [] }),
    fetchImpl: async (url, init) => {
      searches++; assert.equal(url, 'https://api.tavily.com/search'); sourceSignal = init.signal;
      return new Promise(() => {});
    },
  })(request());
  await drain(); assert.equal(searches, 1); assert.equal(c.now(), 14000);
  c.advance(31000); await drain();
  const response = await pending;
  assert.equal(response.status, 504); assert.equal(sourceSignal.aborted, true);
  assert.deepEqual(ops, ['start', 'reserve', 'finish']); assert.equal(searches, 1);
  assert.equal(c.count(), 0);
});
