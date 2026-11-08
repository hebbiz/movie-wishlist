import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';

const user = '00000000-0000-4000-8000-000000000001';
const group = '00000000-0000-4000-8000-000000000002';
const other = '00000000-0000-4000-8000-000000000099';
const form = '10000000-0000-4000-8000-000000000003';
const list = '00000000-0000-4000-8000-000000000004';
const input = { action: 'availability' };
const movieInput = { action: 'discover', imdbId: 'tt1596343', formSession: form };
const request = (data = input, headers = {}) => new Request('https://app.example/.netlify/functions/media-advice', {
  method: 'POST', headers: { origin: 'https://app.example', authorization: 'Bearer AUTHORED', 'content-type': 'application/json', ...headers }, body: JSON.stringify(data),
});
function fixture({ userResult, rpcResult } = {}) {
  const calls = [], state = { auth: 0, discovery: 0, fetches: 0 };
  const client = { auth: { getUser: async token => { state.auth++; assert.equal(token, 'AUTHORED'); return userResult ?? { data: { user: { id: user, user_metadata: { role: 'owner' } } } }; } },
    rpc: async (name, args) => { calls.push({ name, args }); return rpcResult ?? { data: { mykola_media_advice: true, mykola_media_advice_diagnostics: true, sensitive: 'MUST-NOT-RETURN' } }; } };
  const handler = createMediaAdviceHandler({ client, env: () => 'MUST-NOT-READ-SOURCE-KEY',
    run: async () => { state.discovery++; throw Error('unexpected discovery'); },
    fetchImpl: async () => { state.fetches++; throw Error('unexpected source HTTP'); } });
  return { handler, calls, state };
}

test('global availability works before any group/movie/list/form and returns only the display boolean', async () => {
  const { handler, calls, state } = fixture();
  const response = await handler(request({ ...input, userId: other, role: 'owner', country: 'UA', region: 'UA', sourceCap: 999, mykola_media_advice_diagnostics: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mykola_media_advice: true });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls, [{ name: 'media_advice_beta_global_action', args: { p_user: user, p_imdb: null, p_form: null, p_op: 'capability' } }]);
  assert.deepEqual(state, { auth: 1, discovery: 0, fetches: 0 });
});

test('global capability rejects scope fields; malformed movie and apply contexts fail before Auth/RPC', async () => {
  const { handler, calls, state } = fixture();
  for (const data of [
    ...['availability', 'diagnostic-capability'].flatMap(action => ['groupId', 'imdbId', 'listId', 'formSession'].flatMap(field => [null, '', other].map(value => ({ action, [field]: value })))),
    { action: 'capability', groupId: group }, { action: 'apply-capability', groupId: group }, { action: 'discover', groupId: group },
    { ...movieInput, imdbId: 'wrong' }, { ...movieInput, formSession: 'wrong' }, { ...movieInput, action: 'apply-capability', groupId: null },
    { ...movieInput, action: 'apply-capability', groupId: group, listId: 'wrong' }, { action: 'entry-capability', groupId: group },
  ]) assert.equal((await handler(request(data))).status, 400, JSON.stringify(data));
  assert.equal(state.auth, 0); assert.equal(calls.length, 0);
});

test('availability retains same-origin, verified Auth and non-anonymous gates; metadata cannot authorize it', async () => {
  const good = fixture();
  assert.equal((await good.handler(request(input, { origin: 'https://foreign.example' }))).status, 403);
  assert.equal((await good.handler(request(input, { 'sec-fetch-site': 'cross-site' }))).status, 403);
  assert.equal((await good.handler(request(input, { authorization: '' }))).status, 401);
  assert.equal(good.calls.length, 0);
  for (const userResult of [{ error: { message: 'AUTHORED_PRIVATE' } }, { data: { user: null } }, { data: { user: { id: user, is_anonymous: true, user_metadata: { mykola_media_advice: true } } } }]) {
    const { handler, calls } = fixture({ userResult });
    const response = await handler(request()); assert.equal(response.status, 401);
    assert.doesNotMatch(await response.text(), /AUTHORED_PRIVATE/); assert.equal(calls.length, 0);
  }
});

test('global denial or missing migration fails closed without a fake IMDb, ledger action or diagnostics', async () => {
  for (const rpcResult of [{ error: { code: 'PGRST202', message: 'AUTHORED_PRIVATE_MISSING_RPC' } }, { data: null },
    { data: { mykola_media_advice: false, mykola_media_advice_diagnostics: true } }, { data: { mykola_media_advice: 'true' } }]) {
    const { handler, calls, state } = fixture({ rpcResult });
    const response = await handler(request()); assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { status: 'access-unavailable' });
    assert.equal(calls.length, 1); assert.equal(calls[0].name, 'media_advice_beta_global_action'); assert.equal(calls[0].args.p_op, 'capability');
    assert.equal(state.discovery, 0); assert.equal(state.fetches, 0);
  }
});

test('a hung availability RPC respects deadline and cannot trigger finish, fallback or sources after a late result', async () => {
  let expire, resolveRpc; const operations = [];
  const handler = createMediaAdviceHandler({ env: () => '',
    deadlineOptions: { setTimer: fn => { expire = fn; return 1; }, clearTimer() {} },
    client: { auth: { getUser: async () => ({ data: { user: { id: user } } }) },
      rpc: (name, args) => { operations.push({ name, args }); return new Promise(resolve => { resolveRpc = resolve; }); } },
    run: () => { throw Error('unexpected source call'); } });
  const pending = handler(request());
  while (!resolveRpc) await new Promise(resolve => setImmediate(resolve));
  expire(); const response = await pending;
  assert.equal(response.status, 504); assert.deepEqual(await response.json(), { status: 'handler-deadline' });
  resolveRpc({ data: { mykola_media_advice: true } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(operations.length, 1); assert.equal(operations[0].name, 'media_advice_beta_global_action');
});

test('diagnostic capability is fresh and separately gated, never granted by the availability body', async () => {
  for (const granted of [false, true]) {
    const { handler, calls, state } = fixture({ rpcResult: { data: { mykola_media_advice: true, mykola_media_advice_diagnostics: granted, sensitive: 'MUST-NOT-RETURN' } } });
    assert.deepEqual(await (await handler(request())).json(), { mykola_media_advice: true });
    const response = await handler(request({ action: 'diagnostic-capability', mykola_media_advice_diagnostics: true }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { mykola_media_advice: true, mykola_media_advice_diagnostics: granted });
    assert.equal(calls.length, 2); assert.ok(calls.every(call => call.name === 'media_advice_beta_global_action' && call.args.p_imdb === null && call.args.p_form === null));
    assert.equal(state.discovery, 0); assert.equal(state.fetches, 0);
  }
});

test('apply and legacy capability retain full group/list edit scope and fresh server rejection', async () => {
  for (const action of ['apply-capability', 'capability']) {
    const { handler, calls, state } = fixture();
    const response = await handler(request({ ...movieInput, action, groupId: group, listId: list, userId: other, role: 'owner' }));
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ name: 'media_advice_beta_action', args: { p_user: user, p_imdb: movieInput.imdbId, p_form: form, p_group: group, p_list: list, p_op: 'capability' } }]);
    assert.equal(state.discovery, 0); assert.equal(state.fetches, 0);
    const denied = fixture({ rpcResult: { data: { mykola_media_advice: false, mykola_media_advice_diagnostics: true } } });
    assert.equal((await denied.handler(request({ ...movieInput, action, groupId: group, listId: list, role: 'owner' }))).status, 403);
    assert.equal(denied.state.discovery, 0);
  }
});

test('view discovery ignores visitor/group/list claims and uses only verified user, movie and form scope', async () => {
  for (const claims of [{}, { groupId: group, listId: list }, { groupId: null, listId: null }, { groupId: 'not-a-group', listId: 'not-a-list', role: 'visitor', userId: other, country: 'UA' }]) {
    const calls = []; let runCalls = 0;
    const handler = createMediaAdviceHandler({ env: () => '',
      client: { auth: { getUser: async () => ({ data: { user: { id: user, user_metadata: { role: 'visitor', country: 'UA' } } } }) },
        rpc: async (name, args) => { calls.push({ name, args }); return { data: { id: form, cap: 14, attempts: [], mykola_media_advice: true } }; } },
      run: async args => { runCalls++; assert.equal(args.imdbId, movieInput.imdbId); return { rows: [] }; } });
    const response = await handler(request({ ...movieInput, ...claims }));
    assert.equal(response.status, 200); assert.equal(runCalls, 1);
    assert.deepEqual(calls.map(call => call.name), ['media_advice_beta_global_action', 'media_advice_beta_global_action']);
    assert.deepEqual(calls.map(call => call.args.p_op), ['start', 'finish']);
    assert.ok(calls.every(call => call.args.p_user === user && call.args.p_imdb === movieInput.imdbId && call.args.p_form === form && !Object.hasOwn(call.args, 'p_group') && !Object.hasOwn(call.args, 'p_list')));
    assert.equal(calls[0].args.p_stage, 'global-predicted-card-v1');
  }
});

test('cached display success cannot bypass fresh discovery start or finish denial', async () => {
  for (const deniedOp of ['start', 'finish']) {
    let runCalls = 0; const operations = [];
    const handler = createMediaAdviceHandler({ env: () => '',
      client: { auth: { getUser: async () => ({ data: { user: { id: user } } }) },
        rpc: async (_name, args) => { operations.push(args.p_op); return args.p_op === deniedOp
          ? { error: { message: 'AUTHORED_PRIVATE_DENIAL' } }
          : { data: { id: form, cap: 14, mykola_media_advice: true } }; } },
      run: async () => { runCalls++; return { rows: [{ title: 'MUST-NOT-RETURN' }] }; } });
    assert.equal((await handler(request())).status, 200);
    const response = await handler(request({ ...movieInput, mykola_media_advice: true, role: 'owner', country: 'UA' }));
    assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /AUTHORED_PRIVATE|MUST-NOT-RETURN/);
    assert.equal(runCalls, deniedOp === 'start' ? 0 : 1);
    assert.deepEqual(operations, deniedOp === 'start' ? ['capability', 'start'] : ['capability', 'start', 'finish']);
  }
});

test('personal availability is derived from the verified user: two UA users can have opposite flags and diagnostics cannot grant advice', async () => {
  // Authored RPC outcomes exercise HTTP dispatch only. The companion SQL
  // tests separately prove how actual permission rows produce these outcomes.
  const people = new Map([
    [user, { region: 'UA', enabled: true, diagnostics: false }],
    [other, { region: 'UA', enabled: false, diagnostics: true }],
  ]);
  const operations = []; let sources = 0;
  const handler = createMediaAdviceHandler({ env: () => '',
    client: { auth: { getUser: async token => ({ data: { user: { id: token === 'AUTHORED-ALLOW' ? user : other, user_metadata: { region: 'UA', mykola_media_advice: true, role: 'owner' } } } }) },
      rpc: async (name, args) => {
        operations.push({ name, args }); const person = people.get(args.p_user);
        if (!person.enabled) return { error: { message: 'AUTHORED_PRIVATE_PERSONAL_DENIAL' } };
        return { data: { mykola_media_advice: true, mykola_media_advice_diagnostics: person.diagnostics } };
      } },
    run: async () => { sources++; throw Error('unexpected sources'); } });
  const permitted = await handler(request({ action: 'availability' }, { authorization: 'Bearer AUTHORED-ALLOW' }));
  assert.equal(permitted.status, 200); assert.deepEqual(await permitted.json(), { mykola_media_advice: true });
  for (const action of ['availability', 'diagnostic-capability', 'discover']) {
    const body = { ...(action === 'discover' ? movieInput : { action }), action,
      userId: user, country: 'UA', mykola_media_advice: true, mykola_media_advice_diagnostics: true };
    const denied = await handler(request(body, { authorization: 'Bearer AUTHORED-DENY' }));
    assert.equal(denied.status, 403, action);
    assert.doesNotMatch(await denied.text(), /AUTHORED_PRIVATE/);
  }
  assert.equal(sources, 0);
  assert.deepEqual(operations.map(call => call.args.p_user), [user, other, other, other]);
  assert.ok(operations.every(call => call.name === 'media_advice_beta_global_action'));
});

test('personal flag revocation or expiry after startup is checked before new discovery and performs no source calls', async () => {
  for (const change of ['revoked', 'expired']) {
    const flag = { enabled: true, expiresAt: null }; let sources = 0, sourceHTTP = 0;
    const operations = [];
    const handler = createMediaAdviceHandler({ env: () => '',
      client: { auth: { getUser: async () => ({ data: { user: { id: user } } }) },
        rpc: async (name, args) => {
          operations.push({ name, args });
          if (!flag.enabled || flag.expiresAt !== null && flag.expiresAt <= Date.now()) return { error: { message: 'AUTHORED_PRIVATE_PERSONAL_DENIAL' } };
          return { data: { mykola_media_advice: true, mykola_media_advice_diagnostics: true } };
        } },
      run: async () => { sources++; throw Error('unexpected sources'); },
      fetchImpl: async () => { sourceHTTP++; throw Error('unexpected source HTTP'); } });
    assert.equal((await handler(request())).status, 200);
    if (change === 'revoked') flag.enabled = false; else flag.expiresAt = Date.now() - 1;
    const result = await handler(request({ ...movieInput, mykola_media_advice: true }));
    assert.equal(result.status, 403, change);
    assert.equal(sources, 0); assert.equal(sourceHTTP, 0);
    assert.deepEqual(operations.map(call => call.args.p_op), ['capability', 'start']);
  }
});

test('explicit non-UA personal permission is eligible, while the global Beta switch can still deny it', async () => {
  const person = { region: 'DE', enabled: true }; let betaEnabled = true, sources = 0;
  const handler = createMediaAdviceHandler({ env: () => '',
    client: { auth: { getUser: async () => ({ data: { user: { id: user, user_metadata: { region: person.region } } } }) },
      rpc: async () => betaEnabled && person.enabled
        ? { data: { mykola_media_advice: true, mykola_media_advice_diagnostics: false } }
        : { error: { message: 'AUTHORED_PRIVATE_BETA_DENIAL' } } },
    run: async () => { sources++; throw Error('unexpected sources'); } });
  assert.deepEqual(await (await handler(request())).json(), { mykola_media_advice: true });
  betaEnabled = false;
  assert.equal((await handler(request())).status, 403);
  assert.equal((await handler(request(movieInput))).status, 403);
  assert.equal(sources, 0);
});
