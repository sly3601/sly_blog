import {
  API_PREFIX, ApiError, assert, failure, json, privateHeaders, readJson, record,
  sha256, text, MAX_JSON_BYTES, SESSION_SECONDS, IMAGE_NAME, UUID
} from './protocol.js';

const COOKIE = '__Host-sly-workspace';
const CLEAR_COOKIE = `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;

function cookie(request) {
  const values = (request.headers.get('Cookie') || '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(COOKIE + '='));
  return values.length === 1 ? values[0].slice(COOKIE.length + 1) : '';
}
function sameOrigin(request, required = true) {
  const origin = request.headers.get('Origin');
  assert((!required && !origin) || origin === new URL(request.url).origin, 403, 'ORIGIN_FORBIDDEN');
  assert(request.headers.get('Sec-Fetch-Site') !== 'cross-site', 403, 'ORIGIN_FORBIDDEN');
}
async function equalSecret(left, right) {
  const [a, b] = await Promise.all([sha256('workspace-bootstrap-v1\n' + left), sha256('workspace-bootstrap-v1\n' + right)]);
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function method(request, expected) { assert(expected.includes(request.method), 405, 'METHOD_NOT_ALLOWED'); }
function stub(env) {
  assert(env.PRIVATE_WORKSPACE?.idFromName && env.PRIVATE_WORKSPACE?.get, 503, 'PRIVATE_WORKSPACE_NOT_CONFIGURED');
  return env.PRIVATE_WORKSPACE.get(env.PRIVATE_WORKSPACE.idFromName('owner-workspace-v1'));
}
async function call(env, path, value = {}, headers = {}) {
  return stub(env).fetch(new Request('https://workspace.internal' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value)
  }));
}
async function session(request, env) {
  const response = await call(env, '/session/check', { token: cookie(request) });
  if (!response.ok) throw new ApiError(response.status, 'SESSION_UNAVAILABLE');
  const value = await response.json();
  assert(value.authenticated && typeof value.sid === 'string', 401, 'AUTHENTICATION_REQUIRED');
  return value;
}
function csrf(request, value) {
  sameOrigin(request);
  assert(request.headers.get('X-Workspace-CSRF') === value.csrf, 403, 'CSRF_REQUIRED');
}
async function deviceHeaders(request) {
  sameOrigin(request, false);
  const authorization = request.headers.get('Authorization') || '';
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization)?.[1];
  assert(token, 401, 'DEVICE_AUTHENTICATION_REQUIRED');
  return { 'X-Workspace-Device-Hash': await sha256(token) };
}
async function clientKey(request) {
  // Cloudflare supplies this header. No address or user agent is persisted or returned.
  return sha256('workspace-client-v1\n' + (request.headers.get('CF-Connecting-IP') || 'unknown'));
}
function secured(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(privateHeaders())) headers.set(name, value);
  for (const name of [...headers.keys()]) if (name.toLowerCase().startsWith('access-control-')) headers.delete(name);
  return new Response(response.body, { status: response.status, headers });
}

/** Run before the legacy Worker's public OPTIONS/CORS handler. Non-API requests are untouched. */
export async function handlePrivateWorkspace(request, env) {
  const pathname = new URL(request.url).pathname;
  if (pathname !== API_PREFIX && !pathname.startsWith(API_PREFIX + '/')) return null;
  try {
    stub(env); // Missing private binding fails closed; public storage is never a fallback.
    const route = pathname.slice(API_PREFIX.length);
    if (request.method === 'OPTIONS') {
      sameOrigin(request);
      return new Response(null, { status: 204, headers: privateHeaders() });
    }
    if (route === '/session') {
      method(request, ['GET', 'POST', 'DELETE']);
      if (request.method === 'GET') {
        const state = await call(env, '/session/status');
        if (!state.ok) return secured(state);
        const { needsSetup } = await state.json();
        const checked = await call(env, '/session/check', { token: cookie(request) });
        if (!checked.ok) return secured(checked);
        const value = await checked.json();
        return json({ authenticated: !!value.authenticated, needsSetup, ...(value.authenticated ? { csrf: value.csrf } : {}) });
      }
      if (request.method === 'DELETE') {
        const current = await session(request, env); csrf(request, current);
        const response = await call(env, '/session/logout', {}, { 'X-Workspace-Session-Id': current.sid });
        if (!response.ok) return secured(response);
        return json({ authenticated: false }, 200, { 'Set-Cookie': CLEAR_COOKIE });
      }
      sameOrigin(request);
      const body = await readJson(request, 4096); assert(record(body), 400, 'INVALID_BODY');
      const status = await call(env, '/session/status'); if (!status.ok) return secured(status);
      const { needsSetup } = await status.json();
      let bootstrapOk = false;
      if (needsSetup) {
        const expected = String(env.ADMIN_TOKEN || '');
        assert(expected.length > 0, 503, 'BOOTSTRAP_NOT_CONFIGURED');
        const supplied = typeof body.bootstrapToken === 'string' ? body.bootstrapToken : '';
        text(supplied, 2048, 'BOOTSTRAP_TOKEN');
        bootstrapOk = await equalSecret(supplied, expected);
      }
      const response = await call(env, '/session/login', {
        client: await clientKey(request), password: body.password, confirmation: body.confirmation, bootstrapOk
      });
      if (!response.ok) return secured(response);
      const value = await response.json();
      return json({ ok: true, authenticated: true, needsSetup: false, csrf: value.csrf }, 200, {
        'Set-Cookie': `${COOKIE}=${value.token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
      });
    }
    if (route === '/device') {
      method(request, ['POST']); sameOrigin(request, false);
      const body = await readJson(request, 1024); assert(record(body), 400, 'INVALID_BODY');
      return secured(await call(env, '/device/exchange', { code: body.code, client: await clientKey(request) }));
    }
    if (route.startsWith('/bridge/')) {
      const headers = await deviceHeaders(request);
      const image = /^\/bridge\/images\/([^/]+)$/.exec(route);
      if (image) {
        method(request, ['PUT']); assert(IMAGE_NAME.test(image[1]), 400, 'INVALID_IMAGE_NAME');
        return secured(await stub(env).fetch(new Request('https://workspace.internal/image/write/' + image[1], {
          method: 'PUT', headers: { ...headers, 'Content-Type': request.headers.get('Content-Type') || '', ...(request.headers.has('Content-Length') ? { 'Content-Length': request.headers.get('Content-Length') } : {}) },
          body: request.body, duplex: 'half'
        })));
      }
      assert(['/bridge/poll', '/bridge/complete', '/bridge/publish'].includes(route), 404, 'NOT_FOUND');
      method(request, ['POST']);
      const body = await readJson(request, route === '/bridge/poll' ? 4096 : MAX_JSON_BYTES);
      assert(record(body), 400, 'INVALID_BODY');
      return secured(await call(env, route, body, headers));
    }
    const current = await session(request, env);
    const headers = { 'X-Workspace-Session-Id': current.sid };
    if (route === '/pair') {
      method(request, ['POST']); csrf(request, current);
      return secured(await call(env, '/device/pair', {}, headers));
    }
    if (route === '/rpc') {
      method(request, ['POST']); csrf(request, current);
      const body = await readJson(request); assert(record(body), 400, 'INVALID_BODY');
      return secured(await call(env, '/rpc', body, headers));
    }
    const job = /^\/jobs\/([^/]+)$/.exec(route);
    if (job) {
      method(request, ['GET']); assert(UUID.test(job[1]), 400, 'INVALID_JOB_ID');
      return secured(await call(env, '/job', { id: job[1] }, headers));
    }
    const image = /^\/images\/([^/]+)$/.exec(route);
    if (image) {
      method(request, ['GET']); assert(IMAGE_NAME.test(image[1]), 400, 'INVALID_IMAGE_NAME');
      return secured(await call(env, '/image/read', { name: image[1] }, headers));
    }
    if (route === '/activity') {
      method(request, ['POST']); csrf(request, current);
      const body = await readJson(request, 2048); assert(record(body), 400, 'INVALID_BODY');
      return secured(await call(env, '/activity', body, headers));
    }
    throw new ApiError(404, 'NOT_FOUND');
  } catch (error) { return failure(error); }
}
