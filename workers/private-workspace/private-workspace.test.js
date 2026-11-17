import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, randomUUID } from 'node:crypto';
import publicWorker, { PrivateWorkspace } from './worker.js';
import { handlePrivateWorkspace } from './gateway.js';
import { CHUNK_BYTES, MAX_IMAGE_BYTES, sha256, canonical, STORAGE_LIMITS } from './protocol.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const ORIGIN = 'https://private-workspace-test.invalid';
const BOOTSTRAP = 'only-a-fake-bootstrap-test-token';
const PASSWORD = 'only-a-fake-private-test-password';

class FakeStorage {
  constructor(shared = new Map(), controls = {}) { this.values = shared; this.controls = controls; }
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) {
    const size = value instanceof Uint8Array ? value.byteLength : new TextEncoder().encode(JSON.stringify(value)).byteLength;
    assert.ok(size <= 128 * 1024, 'Durable Object single value must stay below 128 KiB');
    if (this.controls.failKey === key) throw new Error('injected storage failure');
    this.values.set(key, structuredClone(value));
  }
  async delete(key) { return this.values.delete(key); }
  async list(options = {}) {
    const values = [...this.values.entries()].filter(([key]) => key.startsWith(options.prefix || '')).sort(([a], [b]) => a.localeCompare(b));
    return new Map(values.slice(0, options.limit || values.length).map(([key, value]) => [key, structuredClone(value)]));
  }
  async transaction(callback) {
    const staged = new Map([...this.values].map(([key, value]) => [key, structuredClone(value)]));
    const transaction = new FakeStorage(staged, this.controls); const result = await callback(transaction);
    this.values.clear(); for (const [key, value] of staged) this.values.set(key, value);
    return result;
  }
}
function fixture(limits = {}) {
  const storage = new FakeStorage(); let now = 1800000000000; let object;
  const restart = () => { object = new PrivateWorkspace({ storage }, {}); object.now = () => now; object.limits = { ...STORAGE_LIMITS, ...limits }; };
  restart();
  const env = { ADMIN_TOKEN: BOOTSTRAP, PRIVATE_WORKSPACE: { idFromName: (name) => name, get: () => ({ fetch: (request) => object.fetch(request) }) } };
  async function request(path, { method = 'GET', body, cookie, csrf, device, origin, headers = {} } = {}) {
    const h = new Headers(headers);
    if (cookie) h.set('Cookie', cookie);
    if (csrf) h.set('X-Workspace-CSRF', csrf);
    if (device) h.set('Authorization', 'Bearer ' + device);
    if (origin !== null && (origin !== undefined || method !== 'GET')) h.set('Origin', origin || ORIGIN);
    let payload;
    if (body !== undefined) {
      payload = body instanceof Uint8Array ? body : JSON.stringify(body);
      if (!(body instanceof Uint8Array)) h.set('Content-Type', 'application/json');
    }
    return handlePrivateWorkspace(new Request(ORIGIN + path, { method, headers: h, body: payload }), env);
  }
  async function login(password = PASSWORD, setup = true, options = {}) {
    const response = await request('/workspace-api/session', { method: 'POST', body: setup ? { bootstrapToken: BOOTSTRAP, password, confirmation: password } : { password }, ...options });
    const data = await response.json();
    return { response, data, cookie: response.headers.get('Set-Cookie')?.split(';')[0], csrf: data.csrf };
  }
  async function bind(owner) {
    const pair = await request('/workspace-api/pair', { method: 'POST', ...owner }); assert.equal(pair.status, 200);
    const { code } = await pair.json(); const exchanged = await request('/workspace-api/device', { method: 'POST', origin: null, body: { code } });
    assert.equal(exchanged.status, 200); return (await exchanged.json()).token;
  }
  return { storage, env, request, login, bind, restart, advance: (milliseconds) => { now += milliseconds; } };
}
function state(version = 'v1') {
  return { version: 1, title: '测试论文', areas: [{ id: 'area-1', title: '控制' }], blocks: [{ id: 'block-1', areaId: 'area-1', title: 'MPC', version, chars: 3, versions: [{ id: version || 'initial', time: '2026-11-17T01:00:00Z', chars: 3, reason: '测试' }] }], drafts: [], feishuSync: { state: 'ready', message: '已同步' } };
}
function map() {
  return { version: 1, revision: 1, rootId: 'root', nodes: [{ id: 'root', parentId: null, title: '理论体系', relation: '', stage: 'foundation', origin: 'unsure' }], associations: [], derivations: [], snapshot: { text: '基：理论体系', characters: 6, bytes: 18, nodeCount: 1 }, topics: [], currentTopicId: '', day: '2026-11-17', busy: false, phase: '', receivedChars: 0 };
}
async function rpc(f, owner, op, args = {}, id = randomUUID()) {
  const response = await f.request('/workspace-api/rpc', { method: 'POST', ...owner, body: { id, op, args } });
  return { response, value: await response.json(), id };
}
async function poll(f, device, body = {}) {
  const response = await f.request('/workspace-api/bridge/poll', { method: 'POST', device, origin: null, body });
  assert.equal(response.status, 200); return response.json();
}
async function complete(f, device, id, result, status = 'ready') {
  return f.request('/workspace-api/bridge/complete', { method: 'POST', device, origin: null, body: status === 'ready' ? { id, status, result } : { id, status, error: result } });
}
function noStore(response) {
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
}

test('standalone Worker never exposes data; gateway handles only its exact API prefix', async () => {
  const f = fixture();
  assert.equal(await f.request('/workspace/index.html'), null);
  assert.equal(await f.request('/workspace-api-other/session'), null);
  const health = await publicWorker.fetch(new Request(ORIGIN + '/health'));
  assert.deepEqual(await health.json(), { ok: true, service: 'private-workspace-state' });
  for (const path of ['/workspace-api/session', '/session/status', '/rpc', '/image/read']) {
    const response = await publicWorker.fetch(new Request(ORIGIN + path)); assert.equal(response.status, 404); noStore(response);
  }
  const missing = await handlePrivateWorkspace(new Request(ORIGIN + '/workspace-api/session'), {});
  assert.equal(missing.status, 503); noStore(missing);
});

test('private reads need authentication; no CORS escape or cross-origin login/write', async () => {
  const f = fixture();
  const status = await f.request('/workspace-api/session'); assert.deepEqual(await status.json(), { authenticated: false, needsSetup: true }); noStore(status);
  for (const path of ['/workspace-api/images/' + 'a'.repeat(64) + '.png', '/workspace-api/jobs/' + randomUUID()]) {
    const response = await f.request(path); assert.equal(response.status, 401); noStore(response);
  }
  const foreign = await f.login(PASSWORD, true, { origin: 'https://evil.invalid' }); assert.equal(foreign.response.status, 403);
  const noOrigin = await f.login(PASSWORD, true, { origin: null }); assert.equal(noOrigin.response.status, 403);
  const preflight = await f.request('/workspace-api/rpc', { method: 'OPTIONS', origin: 'https://evil.invalid' }); assert.equal(preflight.status, 403); noStore(preflight);
});

test('first setup is atomic, independently salted, accepts simple passwords and never resets to ADMIN_TOKEN', async () => {
  const f = fixture();
  const [first, second] = await Promise.all([f.login('1'), f.login('2')]);
  const good = first.response.status === 200 ? first : second;
  assert.deepEqual([first.response.status, second.response.status].sort(), [200, 401]);
  const stored = await f.storage.get('auth:config');
  assert.equal(stored.digest.length, 43); assert.equal(stored.salt.length, 43); assert.equal(stored.sessionKey.length, 43);
  const cookie = good.response.headers.get('Set-Cookie');
  assert.match(cookie, /^__Host-sly-workspace=/); assert.match(cookie, /Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400/);
  assert.equal(good.data.token, undefined); assert.equal(good.data.sessionKey, undefined);
  const oldAdmin = await f.login(BOOTSTRAP, false); assert.equal(oldAdmin.response.status, 401);
  assert.deepEqual(await f.storage.get('auth:config'), stored);
  f.env.ADMIN_TOKEN = 'rotated-fake-token';
  const relogin = await f.login(first.response.status === 200 ? '1' : '2', false); assert.equal(relogin.response.status, 200);
  const status = await f.request('/workspace-api/session', relogin); assert.equal((await status.json()).authenticated, true);
});

test('bad password attempts persist across process restarts and rate limiting commits failures', async () => {
  const f = fixture(); const owner = await f.login(); assert.equal(owner.response.status, 200);
  for (let attempt = 0; attempt < 5; attempt++) { const failed = await f.login('wrong-password', false); assert.equal(failed.response.status, 401); }
  f.restart(); const blocked = await f.login(PASSWORD, false); assert.equal(blocked.response.status, 429); noStore(blocked.response);
  const serialized = JSON.stringify([...f.storage.values]);
  assert.ok(!serialized.includes(PASSWORD)); assert.ok(!serialized.includes(BOOTSTRAP)); assert.ok(!serialized.includes('wrong-password'));
  f.advance(15 * 60 * 1000 + 1); assert.equal((await f.login(PASSWORD, false)).response.status, 200);
});

test('signed sessions survive restart, expire at 24 hours, and logout revokes copied cookies', async () => {
  const f = fixture(); const owner = await f.login(); f.restart();
  assert.equal((await (await f.request('/workspace-api/session', owner)).json()).authenticated, true);
  const corrupted = await f.request('/workspace-api/session', { cookie: owner.cookie + 'a' }); assert.equal((await corrupted.json()).authenticated, false);
  assert.equal((await f.request('/workspace-api/pair', { method: 'POST', cookie: owner.cookie })).status, 403);
  const logout = await f.request('/workspace-api/session', { method: 'DELETE', ...owner }); assert.equal(logout.status, 200); assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await (await f.request('/workspace-api/session', owner)).json()).authenticated, false);
  const next = await f.login(PASSWORD, false); f.advance(24 * 60 * 60 * 1000 + 1);
  assert.equal((await (await f.request('/workspace-api/session', next)).json()).authenticated, false);
});

test('pairing is one-use, short-lived, rate-limited, and device tokens are separate hashed credentials', async () => {
  const f = fixture(); const owner = await f.login();
  const pair = await f.request('/workspace-api/pair', { method: 'POST', ...owner }); const { code } = await pair.json(); assert.match(code, /^\d{8}$/);
  const exchanged = await f.request('/workspace-api/device', { method: 'POST', origin: null, body: { code } }); const { token } = await exchanged.json(); assert.equal(exchanged.status, 200);
  assert.equal((await f.request('/workspace-api/device', { method: 'POST', origin: null, body: { code } })).status, 401);
  assert.ok(!JSON.stringify([...f.storage.values]).includes(token));
  assert.equal((await f.request('/workspace-api/bridge/poll', { method: 'POST', ...owner, body: {} })).status, 401);
  assert.equal((await f.request('/workspace-api/bridge/poll', { method: 'POST', device: token, origin: 'https://evil.invalid', body: {} })).status, 403);
  assert.equal((await poll(f, token)).jobs.length, 0);
  const secondToken = await f.bind(owner);
  assert.equal((await f.request('/workspace-api/bridge/poll', { method: 'POST', device: token, origin: null, body: {} })).status, 401);
  assert.equal((await poll(f, secondToken)).jobs.length, 0);
  const expiredPair = await f.request('/workspace-api/pair', { method: 'POST', ...owner }); const expired = (await expiredPair.json()).code; f.advance(10 * 60 * 1000 + 1);
  assert.equal((await f.request('/workspace-api/device', { method: 'POST', origin: null, body: { code: expired } })).status, 401);
  for (let i = 0; i < 7; i++) assert.equal((await f.request('/workspace-api/device', { method: 'POST', origin: null, body: { code: 'wrong' } })).status, 401);
  f.restart(); assert.equal((await f.request('/workspace-api/device', { method: 'POST', origin: null, body: { code: 'wrong' } })).status, 429);
});

test('RPC UUID is idempotent, changed payload conflicts, and owner can resume after logging in again', async () => {
  const f = fixture(); const owner = await f.login(); const device = await f.bind(owner); const id = randomUUID();
  const one = await rpc(f, owner, 'thesis.document', { id: 'block-1', version: 'v1' }, id); assert.equal(one.response.status, 202);
  assert.equal((await rpc(f, owner, 'thesis.document', { version: 'v1', id: 'block-1' }, id)).response.status, 202);
  assert.equal((await rpc(f, owner, 'thesis.document', { id: 'block-1', version: 'v2' }, id)).response.status, 409);
  assert.equal((await rpc(f, owner, 'gpt.generate')).response.status, 400);
  const another = await f.login(PASSWORD, false); assert.equal((await f.request('/workspace-api/jobs/' + id, another)).status, 200);
  const [a, b] = await Promise.all([poll(f, device), poll(f, device)]); assert.equal(a.jobs.length + b.jobs.length, 1); assert.equal([...a.jobs, ...b.jobs][0].id, id);
  const unclaimed = await rpc(f, owner, 'thesis.document', { id: 'block-1' }); assert.equal((await complete(f, device, unclaimed.id, { id: 'block-1', version: 'v1', text: 'x' })).status, 409);
  const result = { id: 'block-1', version: 'v1', text: '正文' };
  assert.equal((await complete(f, device, id, result)).status, 200); assert.equal((await (await complete(f, device, id, result)).json()).duplicate, true);
  assert.equal((await complete(f, device, id, { ...result, text: 'different' })).status, 409);
  const saved = await f.request('/workspace-api/jobs/' + id, owner); assert.deepEqual((await saved.json()).result, result); noStore(saved);
});

test('metadata publish strips AI/fulltext/path data; document cache is lazy and isolated by version', async () => {
  const f = fixture(); const owner = await f.login(); const device = await f.bind(owner);
  const fullState = { ...state(), output: { directory: 'C:/secret-path' }, gptMemory: { text: 'private AI' }, drafts: [{ content: 'AI draft' }], text: 'must not be cached in state' };
  const fullMap = { ...map(), topics: [{ messages: [{ text: 'private AI chat' }] }], exportPath: 'D:/private' };
  const published = await f.request('/workspace-api/bridge/publish', { method: 'POST', device, origin: null, body: { thesis: fullState, innovation: fullMap } }); assert.equal(published.status, 200);
  const cachedState = await rpc(f, owner, 'thesis.state'); assert.equal(cachedState.value.status, 'ready'); assert.equal(cachedState.value.result.output, undefined); assert.deepEqual(cachedState.value.result.drafts, []);
  const cachedMap = await rpc(f, owner, 'innovation.state'); assert.equal(cachedMap.value.result.snapshot.text, map().snapshot.text); assert.deepEqual(cachedMap.value.result.topics, []); assert.equal(cachedMap.value.result.exportPath, undefined);
  assert.equal((await poll(f, device)).jobs.length, 0);
  const first = await rpc(f, owner, 'thesis.document', { id: 'block-1' }); assert.equal(first.value.status, 'pending'); await poll(f, device);
  const document = { id: 'block-1', version: 'v1', text: '公式与图文\n'.repeat(60000) };
  assert.equal((await complete(f, device, first.id, document)).status, 200);
  const chunkSizes = [...f.storage.values].filter(([key]) => key.startsWith('chunk:')).map(([, value]) => value.byteLength);
  assert.ok(chunkSizes.length > 10); assert.ok(chunkSizes.every((size) => size <= CHUNK_BYTES));
  assert.deepEqual((await rpc(f, owner, 'thesis.document', { id: 'block-1' })).value.result, document);
  await f.request('/workspace-api/bridge/publish', { method: 'POST', device, origin: null, body: { thesis: state('v2') } });
  assert.equal((await rpc(f, owner, 'thesis.document', { id: 'block-1' })).value.status, 'pending');
  assert.equal((await rpc(f, owner, 'thesis.document', { id: 'block-1', version: 'v1' })).value.status, 'ready');
});

test('expired write leases become uncertain without replay; late completion safely resolves original UUID', async () => {
  const f = fixture(); const owner = await f.login(); const device = await f.bind(owner);
  const write = await rpc(f, owner, 'thesis.edit', { change: { kind: 'save', id: 'block-1', expectedVersion: 'v1', text: 'new' } }); await poll(f, device);
  f.advance(60001); const heartbeat = await poll(f, device, { lease: write.id }); assert.deepEqual(heartbeat.jobs, []);
  const current = await f.request('/workspace-api/jobs/' + write.id, owner); assert.equal((await current.json()).status, 'uncertain');
  assert.deepEqual((await poll(f, device)).jobs, []);
  assert.equal((await rpc(f, owner, 'thesis.edit', { change: { kind: 'save', id: 'block-1', expectedVersion: 'v1', text: 'new' } }, write.id)).value.status, 'uncertain');
  assert.equal((await complete(f, device, write.id, state('v2'))).status, 200);
  assert.equal((await rpc(f, owner, 'thesis.state')).value.result.blocks[0].version, 'v2');
  const read = await rpc(f, owner, 'thesis.manuscript'); await poll(f, device); f.advance(60001);
  const reissued = await poll(f, device); assert.equal(reissued.jobs[0].id, read.id);
  f.advance(40000); await poll(f, device, { lease: read.id }); f.advance(40000);
  assert.deepEqual((await poll(f, device)).jobs, []);
  assert.equal((await complete(f, device, read.id, 'cannot read now', 'error')).status, 200);
  assert.deepEqual((await poll(f, device)).jobs, []);
});

test('heartbeat never consumes a subsequent job, and failed chunk writes leave job/state unchanged', async () => {
  const f = fixture(); const owner = await f.login(); const device = await f.bind(owner);
  const first = await rpc(f, owner, 'thesis.document', { id: 'block-1' }); await poll(f, device);
  const next = await rpc(f, owner, 'thesis.manuscript');
  const result = { id: 'block-1', version: 'v1', text: 'x'.repeat(CHUNK_BYTES * 3) };
  const cache = 'document:' + await sha256(canonical({ id: result.id, version: result.version }));
  f.storage.controls.failKey = 'chunk:' + cache + ':1';
  assert.equal((await complete(f, device, first.id, result)).status, 500);
  assert.equal(await f.storage.get('blob:result:' + first.id), undefined);
  assert.equal(await f.storage.get('blob:' + cache), undefined);
  assert.equal((await f.storage.get('job:' + first.id)).status, 'running');
  delete f.storage.controls.failKey;
  assert.equal((await complete(f, device, first.id, result)).status, 200);
  assert.deepEqual((await poll(f, device, { lease: first.id })).jobs, []);
  assert.equal((await poll(f, device)).jobs[0].id, next.id);
});

test('private images round-trip as 64 KiB chunks with SHA/type validation, auth and no public cache', async () => {
  const f = fixture(); const owner = await f.login(); const device = await f.bind(owner);
  const data = new Uint8Array(CHUNK_BYTES * 3 + 23); data.set([137, 80, 78, 71, 13, 10, 26, 10]);
  for (let i = 8; i < data.length; i++) data[i] = i % 251;
  const name = await sha256(data) + '.png';
  const put = (body, headers = {}, assetName = name) => f.request('/workspace-api/bridge/images/' + assetName, { method: 'PUT', device, origin: null, body, headers: { 'Content-Type': 'image/png', ...headers } });
  assert.equal((await put(data)).status, 200); assert.equal((await (await put(data)).json()).duplicate, true);
  const response = await f.request('/workspace-api/images/' + name, owner); assert.equal(response.status, 200); noStore(response); assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), data);
  assert.equal((await f.request('/workspace-api/images/' + name)).status, 401);
  assert.equal((await f.request('/workspace-api/images/' + 'b'.repeat(64) + '.png', owner)).status, 404);
  assert.equal((await put(data, { 'Content-Type': 'image/jpeg' })).status, 415);
  assert.equal((await put(new TextEncoder().encode('<svg></svg>'))).status, 415);
  assert.equal((await put(data, {}, 'a'.repeat(64) + '.png')).status, 422);
  assert.equal((await put(data, { 'Content-Length': String(MAX_IMAGE_BYTES + 1) })).status, 413);
  assert.equal((await put(data, {}, 'test.svg')).status, 400);
  for (const [extension, mime, signature] of [['jpg', 'image/jpeg', [255, 216, 255, 0]], ['gif', 'image/gif', [...new TextEncoder().encode('GIF89a')]], ['webp', 'image/webp', [...new TextEncoder().encode('RIFF0000WEBP')]]]) {
    const value = Uint8Array.from(signature); const image = await sha256(value) + '.' + extension;
    assert.equal((await put(value, { 'Content-Type': mime }, image)).status, 200);
  }
});

test('activity expires, and importImage cannot publish a public/fake path or uncached image', async () => {
  const f = fixture(); const owner = await f.login(); const device = await f.bind(owner);
  assert.equal((await f.request('/workspace-api/activity', { method: 'POST', ...owner, body: { tabId: 'tab-1', dirty: true, syncInput: false } })).status, 200);
  assert.equal((await poll(f, device)).activity, true); f.advance(30001); assert.equal((await poll(f, device)).activity, false);
  const image = await rpc(f, owner, 'thesis.importImage', { name: 'test.png', bytesB64: 'aGVsbG8=' }); await poll(f, device);
  assert.equal((await complete(f, device, image.id, { reference: 'https://public.invalid/test.png', markdown: '', filePath: '' })).status, 400);
  assert.equal((await complete(f, device, image.id, { reference: 'images/' + 'a'.repeat(64) + '.png', markdown: '', filePath: '' })).status, 409);
  const data = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]); const name = await sha256(data) + '.png';
  await f.request('/workspace-api/bridge/images/' + name, { method: 'PUT', device, origin: null, body: data, headers: { 'Content-Type': 'image/png' } });
  assert.equal((await complete(f, device, image.id, { reference: 'images/' + name, markdown: '![](images/' + name + ')', filePath: 'C:/must-not-leak' })).status, 200);
  const result = await (await f.request('/workspace-api/jobs/' + image.id, owner)).json(); assert.equal(result.result.filePath, '');
});

test('expired large results become permanent digest tombstones, never new jobs after relogin', async () => {
  const f = fixture(); const owner = await f.login(); const device = await f.bind(owner);
  const args = { change: { kind: 'save', id: 'block-1', expectedVersion: 'v1', text: 'new text' } };
  const write = await rpc(f, owner, 'thesis.edit', args); await poll(f, device); await complete(f, device, write.id, state('v2'));
  f.advance(24 * 60 * 60 * 1000 + 1); const relogin = await f.login(PASSWORD, false);
  await rpc(f, relogin, 'thesis.state'); // Prunes old large payloads, retaining UUID and digest.
  assert.equal((await f.storage.get('job:' + write.id)).status, 'expired');
  assert.equal(await f.storage.get('blob:result:' + write.id), undefined);
  const same = await rpc(f, relogin, 'thesis.edit', args, write.id); assert.equal(same.value.status, 'error');
  assert.equal((await rpc(f, relogin, 'thesis.edit', { ...args, change: { ...args.change, text: 'different' } }, write.id)).response.status, 409);
  assert.deepEqual((await poll(f, device)).jobs, []);
  assert.equal((await (await complete(f, device, write.id, state('v2'))).json()).duplicate, true);
});

test('unknown/corrupted authentication storage fails closed without silently reinitializing', async () => {
  const f = fixture(); await f.storage.put('auth:config', { version: 99, marker: 'preserve-this' });
  assert.equal((await f.request('/workspace-api/session')).status, 503);
  assert.equal((await f.login()).response.status, 503);
  assert.deepEqual(await f.storage.get('auth:config'), { version: 99, marker: 'preserve-this' });
});

test('confirmed large arguments are released, while aggregate budget preserves uncertain evidence', async () => {
  assert.equal(STORAGE_LIMITS.pendingBytes, 32 * 1024 * 1024);
  const f = fixture({ pendingBytes: 350 }); const owner = await f.login(); const device = await f.bind(owner);
  const args = { change: { kind: 'save', id: 'block-1', expectedVersion: 'v1', text: 'x'.repeat(150) } };
  const first = await rpc(f, owner, 'thesis.edit', args); assert.equal(first.response.status, 202);
  const size = (await f.storage.get('blob:args:' + first.id)).length; assert.ok(size > 200);
  const rejectedId = randomUUID(); const rejected = await rpc(f, owner, 'thesis.edit', args, rejectedId);
  assert.equal(rejected.response.status, 413); assert.equal(await f.storage.get('job:' + rejectedId), undefined);
  await poll(f, device); f.advance(60001); await f.request('/workspace-api/jobs/' + first.id, owner);
  assert.equal((await f.storage.get('job:' + first.id)).status, 'uncertain');
  assert.equal((await f.storage.get('blob:args:' + first.id)).length, size); assert.equal(await f.storage.get('queue:bytes'), size);
  assert.equal((await complete(f, device, first.id, state('v2'))).status, 200);
  assert.equal(await f.storage.get('blob:args:' + first.id), undefined); assert.equal(await f.storage.get('queue:bytes'), 0);
  const proof = await f.storage.get('job:' + first.id); assert.equal(proof.payloadHash.length, 64); assert.equal(proof.completionHash.length, 64); assert.equal(proof.resultRef, 'published:thesis'); assert.equal(proof.result, undefined);
  assert.equal((await rpc(f, owner, 'thesis.edit', args, rejectedId)).response.status, 202);
  await poll(f, device); await complete(f, device, rejectedId, 'explicit known failure', 'error');
  assert.equal(await f.storage.get('blob:args:' + rejectedId), undefined); assert.equal(await f.storage.get('queue:bytes'), 0);
});

test('document cache uses total bytes, and evicted historic reads never recreate their UUID', async () => {
  assert.equal(STORAGE_LIMITS.documentBytes, 128 * 1024 * 1024);
  const f = fixture({ documentBytes: 70000 }); const owner = await f.login(); const device = await f.bind(owner);
  const first = await rpc(f, owner, 'thesis.document', { id: 'block-1', version: 'v1' }); await poll(f, device);
  await complete(f, device, first.id, { id: 'block-1', version: 'v1', text: 'a'.repeat(50000) });
  const second = await rpc(f, owner, 'thesis.document', { id: 'block-1', version: 'v2' }); await poll(f, device);
  await complete(f, device, second.id, { id: 'block-1', version: 'v2', text: 'b'.repeat(50000) });
  const index = await f.storage.get('documents:index'); assert.equal(index.length, 1); assert.ok(index.reduce((sum, entry) => sum + entry.bytes, 0) <= 70000);
  assert.equal(await f.storage.get('blob:args:' + second.id), undefined); assert.equal(await f.storage.get('blob:result:' + second.id), undefined);
  const expired = await (await f.request('/workspace-api/jobs/' + first.id, owner)).json(); assert.equal(expired.status, 'error'); assert.match(expired.error, /历史读取结果已过期/);
  assert.equal((await rpc(f, owner, 'thesis.document', { id: 'block-1', version: 'v1' }, first.id)).value.status, 'error'); assert.deepEqual((await poll(f, device)).jobs, []);
  const newRead = await rpc(f, owner, 'thesis.document', { id: 'block-1', version: 'v1' }); assert.equal(newRead.value.status, 'pending'); assert.equal((await poll(f, device)).jobs[0].id, newRead.id);
});

test('metadata results reference the latest manifest and temporary long reads have a total byte cap', async () => {
  const f = fixture({ temporaryBytes: 70000, inlineBytes: 100 }); const owner = await f.login(); const device = await f.bind(owner);
  const write = await rpc(f, owner, 'thesis.edit', { change: { kind: 'title', title: 'new' } }); await poll(f, device); await complete(f, device, write.id, state('v2'));
  const originalProof = (await f.storage.get('job:' + write.id)).completionHash;
  await f.request('/workspace-api/bridge/publish', { method: 'POST', device, origin: null, body: { thesis: state('v3') } });
  const refreshed = await (await f.request('/workspace-api/jobs/' + write.id, owner)).json(); assert.equal(refreshed.status, 'ready'); assert.equal(refreshed.result.blocks[0].version, 'v3');
  assert.equal((await f.storage.get('job:' + write.id)).completionHash, originalProof); assert.equal(await f.storage.get('blob:result:' + write.id), undefined);
  const first = await rpc(f, owner, 'thesis.manuscript'); await poll(f, device); await complete(f, device, first.id, 'a'.repeat(50000));
  const second = await rpc(f, owner, 'thesis.manuscript'); await poll(f, device); await complete(f, device, second.id, 'b'.repeat(50000));
  const index = await f.storage.get('results:index'); assert.equal(index.length, 1); assert.ok(index.reduce((sum, entry) => sum + entry.bytes, 0) <= 70000);
  assert.equal((await (await f.request('/workspace-api/jobs/' + first.id, owner)).json()).status, 'error');
  assert.equal((await (await f.request('/workspace-api/jobs/' + second.id, owner)).json()).result.length, 50000);
  assert.equal(await f.storage.get('queue:bytes'), 0);
});
