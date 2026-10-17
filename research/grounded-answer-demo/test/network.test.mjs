import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemo } from '../server.mjs';
import { networkConfig } from '../network.mjs';
import { syntheticResponse } from '../synthetic.mjs';
import { request as httpRequest } from 'node:http';

const address = '192.168.88.7'; // Synthetic address; no machine's LAN is bound by these tests.
const interfaces = { test: [{ address, internal: false, family: 'IPv4' }] };
const password = 'offline-auth-fixture';
const auth = `Basic ${Buffer.from(`demo:${password}`).toString('base64')}`;

test('localhost default remains loopback, LAN requires assigned private IPv4 and password', () => {
  assert.equal(networkConfig().bindAddress, '127.0.0.1');
  for (const bindIPv4 of [undefined, '', '0.0.0.0', '127.0.0.1', '8.8.8.8', '169.254.1.1', '::1', '192.168.88.8', '192.168.088.7', 'localhost']) {
    assert.throws(() => networkConfig({ access: 'lan', bindIPv4, lanPassword: password, interfaces }), /IPv4/);
  }
  for (const lanPassword of ['', ' ', undefined, 'a\nb']) assert.throws(() => networkConfig({ access: 'lan', bindIPv4: address, lanPassword, interfaces }), /PASSWORD/);
  assert.throws(() => networkConfig({ access: 'public' }), /DEMO_ACCESS/);
  assert.throws(() => networkConfig({ bindIPv4: address }), /Unset/);
  assert.equal(networkConfig({ access: 'lan', bindIPv4: address, lanPassword: password, interfaces }).bindAddress, address);
});

test('Basic authentication requires the exact username/password and strict encoding', () => {
  const config = networkConfig({ access: 'lan', bindIPv4: address, lanPassword: password, interfaces });
  assert.equal(config.authorized(auth), true);
  assert.equal(config.authorized(auth.replace('Basic', 'basic')), true);
  for (const header of [undefined, '', 'Bearer arbitrary', 'Basic !!!', `${auth}=`, `Basic ${Buffer.from(`wrong:${password}`).toString('base64')}`, `Basic ${Buffer.from('demo:wrong').toString('base64')}`]) assert.equal(config.authorized(header), false);
});

async function start(t, overrides = {}) {
  let calls = 0;
  const server = createDemo({ access: 'lan', bindIPv4: address, lanPassword: password, interfaces, ...overrides, fetchImpl: async () => { calls++; return Response.json(syntheticResponse()); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const origin = `http://${address}:${port}`;
  const local = `http://127.0.0.1:${port}`;
  // Native HTTP lets the loopback test explicitly set the synthetic LAN Host.
  const request = (path, options = {}) => new Promise((resolve, reject) => {
    const req = httpRequest(`${local}${path}`, { ...options, headers: { Host: `${address}:${port}`, ...options.headers } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })));
    });
    req.on('error', reject); req.end();
  });
  return { origin, request, calls: () => calls };
}

test('all routes/assets require auth; unauthorized requests cannot allocate sessions or spend a token', async t => {
  const { request, origin, calls } = await start(t);
  for (const path of ['/', '/client.mjs', '/display.mjs', '/style.css', '/session', '/answer', '/missing']) {
    const response = await request(path);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate'), /^Basic /);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  // If these allocated tokens the 100-session limit would block the valid request.
  for (let i = 0; i < 105; i++) assert.equal((await request('/session')).status, 401);
  const sessionResponse = await request('/session', { headers: { Authorization: auth } });
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  const headers = { Origin: origin, 'x-demo-session': session.token };
  assert.equal((await request('/answer', { method: 'POST', headers })).status, 401);
  assert.equal((await request('/answer', { method: 'POST', headers: { ...headers, Authorization: 'Basic d3Jvbmc=' } })).status, 401);
  assert.equal(calls(), 0);
  const response = await request('/answer', { method: 'POST', headers: { ...headers, Authorization: auth } });
  assert.equal(response.status, 200);
  assert.match((await response.json()).response.candidates[0].content.parts[0].text, /SYNTHETIC ONLY/);
  assert.equal((await request('/answer', { method: 'POST', headers: { ...headers, Authorization: auth } })).status, 409);
  assert.equal(calls(), 0);
});

test('wrong Host/Origin cannot reach mock Gemini, good auth invokes it once; no credentials in payload/assets', async t => {
  const { request, origin, calls } = await start(t, { mode: 'live', apiKey: 'offline-key-fixture' });
  for (const path of ['/', '/client.mjs', '/session']) {
    const response = await request(path, { headers: { Authorization: auth } });
    const text = await response.text();
    for (const secret of [password, auth, 'offline-key-fixture']) assert.ok(!text.includes(secret));
  }
  const session = await (await request('/session', { headers: { Authorization: auth } })).json();
  const headers = { Authorization: auth, Origin: origin, 'x-demo-session': session.token };
  assert.equal((await request('/answer', { method: 'POST', headers: { ...headers, Host: 'localhost' } })).status, 403);
  assert.equal((await request('/answer', { method: 'POST', headers: { ...headers, Origin: 'http://example.com' } })).status, 403);
  const noOrigin = { ...headers }; delete noOrigin.Origin;
  assert.equal((await request('/answer', { method: 'POST', headers: noOrigin })).status, 403);
  assert.equal(calls(), 0);
  assert.equal((await request('/answer', { method: 'POST', headers })).status, 200);
  assert.equal((await request('/answer', { method: 'POST', headers })).status, 409);
  assert.equal(calls(), 1);
});
