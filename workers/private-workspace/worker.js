import {
  ApiError, assert, failure, json, privateHeaders, readJson, readBytes, record, text,
  identifier, integer, bytes, decode, boundedJson, canonical, sha256, randomToken,
  base64url, unbase64url, imageType, CHUNK_BYTES, MAX_IMAGE_BYTES, MAX_JSON_BYTES,
  MAX_RESULT_BYTES, MAX_META_BYTES, SESSION_SECONDS, LEASE_MS, OPS, READ_OPS, UUID, IMAGE_NAME, STORAGE_LIMITS
} from './protocol.js';

const SESSION_MS = SESSION_SECONDS * 1000;
const RATE_MS = 15 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_JOBS = 64;
const MAX_RECENT_JOBS = 256;
const OWNER = 'single-owner-v1';
const STAGES = new Set(['foundation', 'implemented', 'theory', 'direction']);
const ORIGINS = new Set(['prior-work', 'my-idea', 'unsure']);

async function writeBlob(storage, name, data) {
  const value = bytes(data); const previous = await storage.get('blob:' + name);
  const count = Math.ceil(value.byteLength / CHUNK_BYTES);
  for (let i = 0; i < count; i++) await storage.put(`chunk:${name}:${i}`, value.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES), { noCache: true });
  await storage.put('blob:' + name, { count, length: value.byteLength });
  for (let i = count; i < (previous?.count || 0); i++) await storage.delete(`chunk:${name}:${i}`);
}
async function readBlob(storage, name) {
  const meta = await storage.get('blob:' + name); if (!meta) return undefined;
  assert(Number.isInteger(meta.count) && Number.isInteger(meta.length) && meta.length >= 0 && meta.length <= MAX_JSON_BYTES && meta.count === Math.ceil(meta.length / CHUNK_BYTES), 500, 'STORAGE_INCOMPLETE');
  const data = new Uint8Array(meta.length);
  for (let i = 0; i < meta.count; i++) {
    const chunk = await storage.get(`chunk:${name}:${i}`, { noCache: true });
    assert(chunk instanceof Uint8Array && chunk.byteLength === Math.min(CHUNK_BYTES, meta.length - i * CHUNK_BYTES), 500, 'STORAGE_INCOMPLETE');
    data.set(chunk, i * CHUNK_BYTES);
  }
  return data;
}
async function deleteBlob(storage, name) {
  const meta = await storage.get('blob:' + name); if (!meta) return;
  for (let i = 0; i < meta.count; i++) await storage.delete(`chunk:${name}:${i}`);
  await storage.delete('blob:' + name);
}
async function readValue(storage, name) {
  const data = await readBlob(storage, name);
  if (!data) return undefined;
  try { return JSON.parse(decode(data)); } catch { throw new ApiError(500, 'STORAGE_INCOMPLETE'); }
}
async function writeValue(storage, name, value, limit = MAX_RESULT_BYTES) {
  return writeBlob(storage, name, boundedJson(value, limit));
}
function optionalText(value, key, max = 100) {
  return value[key] === undefined ? {} : { [key]: text(value[key], max, key.toUpperCase()) };
}
export function cleanThesis(value) {
  assert(record(value) && value.version === 1 && Array.isArray(value.areas) && Array.isArray(value.blocks), 400, 'INVALID_THESIS_STATE');
  assert(value.areas.length <= 10000 && value.blocks.length <= 20000, 413, 'TOO_MANY_SECTIONS');
  const areas = value.areas.map((area) => { assert(record(area), 400, 'INVALID_AREA'); return { id: identifier(area.id), title: text(area.title, 500, 'TITLE') }; });
  const areaIds = new Set(areas.map((area) => area.id)); assert(areaIds.size === areas.length, 400, 'DUPLICATE_AREA');
  const blocks = value.blocks.map((block) => {
    assert(record(block) && areaIds.has(block.areaId), 400, 'INVALID_BLOCK');
    const versions = Array.isArray(block.versions) ? block.versions.slice(-30).map((version) => {
      assert(record(version), 400, 'INVALID_VERSION');
      return { id: identifier(version.id), time: text(version.time, 100, 'TIME'), chars: integer(version.chars, 0, 1000000000, 'CHARS'), reason: text(version.reason, 500, 'REASON') };
    }) : [];
    return { id: identifier(block.id), areaId: identifier(block.areaId), title: text(block.title, 500, 'TITLE'), version: text(block.version, 200, 'VERSION'), chars: integer(block.chars, 0, 1000000000, 'CHARS'), versions, ...optionalText(block, 'archivedAt'), ...optionalText(block, 'deletedAt') };
  });
  assert(new Set(blocks.map((block) => block.id)).size === blocks.length, 400, 'DUPLICATE_BLOCK');
  const result = { version: 1, title: text(value.title, 500, 'TITLE'), areas, blocks, drafts: [] };
  if (record(value.feishuSync)) {
    assert(['off', 'ready', 'blocked'].includes(value.feishuSync.state), 400, 'INVALID_SYNC_STATE');
    result.feishuSync = { state: value.feishuSync.state, message: text(value.feishuSync.message, 2000, 'MESSAGE'), ...optionalText(value.feishuSync, 'lastAt') };
  }
  boundedJson(result, MAX_META_BYTES); return result;
}
export function cleanInnovation(value) {
  assert(record(value) && value.version === 1 && Array.isArray(value.nodes) && value.nodes.length > 0 && value.nodes.length <= 10000 && Array.isArray(value.associations), 400, 'INVALID_INNOVATION_MAP');
  const nodes = value.nodes.map((node) => {
    assert(record(node) && STAGES.has(node.stage) && ORIGINS.has(node.origin), 400, 'INVALID_NODE');
    const result = { id: identifier(node.id), parentId: node.parentId === null ? null : identifier(node.parentId), title: text(node.title, 500, 'TITLE'), relation: text(node.relation, 200, 'RELATION'), stage: node.stage, origin: node.origin };
    if (node.reference !== undefined) {
      assert(record(node.reference), 400, 'INVALID_REFERENCE');
      result.reference = { title: text(node.reference.title, 500, 'PAPER_TITLE'), venue: text(node.reference.venue, 300, 'VENUE'), year: text(node.reference.year, 50, 'YEAR') };
    }
    return result;
  });
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  assert(nodeMap.size === nodes.length && nodeMap.has(value.rootId) && nodeMap.get(value.rootId).parentId === null, 400, 'INVALID_ROOT');
  const checked = new Set([value.rootId]);
  for (const node of nodes) {
    const path = new Set(); let cursor = node;
    while (!checked.has(cursor.id)) {
      assert(!path.has(cursor.id) && nodeMap.has(cursor.parentId), 400, 'INVALID_TREE_STRUCTURE');
      path.add(cursor.id); cursor = nodeMap.get(cursor.parentId);
    }
    for (const id of path) checked.add(id);
  }
  assert(value.associations.length <= 20000 && (value.derivations || []).length <= 20000, 413, 'TOO_MANY_RELATIONS');
  const associations = value.associations.map((edge) => {
    assert(record(edge) && nodeMap.has(edge.from) && nodeMap.has(edge.to) && edge.from !== edge.to, 400, 'INVALID_ASSOCIATION');
    return { id: identifier(edge.id), from: edge.from, to: edge.to, relation: text(edge.relation, 200, 'RELATION') };
  });
  const derivations = (value.derivations || []).map((edge) => {
    assert(record(edge) && Array.isArray(edge.parents) && edge.parents.length === 2 && edge.parents[0] !== edge.parents[1] && edge.parents.every((id) => nodeMap.has(id) && id !== edge.child) && nodeMap.has(edge.child), 400, 'INVALID_DERIVATION');
    return { id: identifier(edge.id), parents: [...edge.parents], child: edge.child, relation: text(edge.relation, 200, 'RELATION') };
  });
  assert(record(value.snapshot), 400, 'INVALID_SNAPSHOT');
  const result = { version: 1, revision: integer(value.revision, 0, Number.MAX_SAFE_INTEGER, 'REVISION'), rootId: value.rootId, nodes, associations, derivations,
    snapshot: { text: text(value.snapshot.text, 1000000, 'SNAPSHOT'), characters: integer(value.snapshot.characters, 0, 10000000, 'CHARACTERS'), bytes: integer(value.snapshot.bytes, 0, 10000000, 'BYTES'), nodeCount: integer(value.snapshot.nodeCount, 0, 10000, 'NODE_COUNT') },
    topics: [], currentTopicId: '', day: typeof value.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.day) ? value.day : '', busy: false, phase: '', receivedChars: 0 };
  boundedJson(result, MAX_META_BYTES); return result;
}
function rpcArguments(op, args) {
  assert(OPS.has(op) && record(args), 400, 'OPERATION_NOT_ALLOWED');
  if (op === 'thesis.document') { identifier(args.id); if (args.version !== undefined) text(args.version, 200, 'VERSION'); }
  if (op === 'thesis.edit' || op === 'innovation.change') assert(record(args.change) && typeof args.change.kind === 'string', 400, 'INVALID_CHANGE');
  if (op === 'innovation.change') integer(args.revision, 0, Number.MAX_SAFE_INTEGER, 'REVISION');
  if (op === 'thesis.importImage') { text(args.name, 300, 'IMAGE_NAME', false); text(args.bytesB64, 28 * 1024 * 1024, 'IMAGE_BYTES', false); assert(!/[\\/\x00-\x1f]/.test(args.name), 400, 'INVALID_IMAGE_NAME'); }
  boundedJson(args, MAX_JSON_BYTES - 1024);
}
async function passwordDigest(password, salt) {
  const key = await crypto.subtle.importKey('raw', bytes(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unbase64url(salt), iterations: 100000 }, key, 256));
}
function sameBytes(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  let difference = 0; for (let i = 0; i < a.byteLength; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
async function hmacKey(config, usage) { return crypto.subtle.importKey('raw', unbase64url(config.sessionKey), { name: 'HMAC', hash: 'SHA-256' }, false, usage); }
async function signedSession(config, payload) {
  const encoded = base64url(bytes(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(config, ['sign']), bytes(encoded));
  return encoded + '.' + base64url(new Uint8Array(signature));
}

/** This class is reachable through a Pages binding only. The Worker's public fetch never forwards to it. */
export class PrivateWorkspace {
  constructor(ctx, env) { this.storage = ctx.storage; this.env = env; this.tail = Promise.resolve(); this.now = () => Date.now(); this.limits = STORAGE_LIMITS; }
  fetch(request) {
    const run = this.tail.then(async () => {
      try { return await this.storage.transaction((storage) => this.dispatch(request, storage)); }
      catch (error) { return failure(error); }
    });
    this.tail = run.then(() => undefined, () => undefined); return run;
  }
  async authConfig(storage) {
    const config = await storage.get('auth:config');
    if (config !== undefined) assert(record(config) && config.version === 1 && /^[A-Za-z0-9_-]{43}$/.test(config.salt) && /^[A-Za-z0-9_-]{43}$/.test(config.digest) && /^[A-Za-z0-9_-]{43}$/.test(config.sessionKey), 503, 'AUTH_CONFIG_INVALID');
    return config;
  }
  async rateAllowed(storage, kind, client) {
    const now = this.now();
    const local = await storage.get(`rate:${kind}:${client}`); const global = await storage.get(`rate:${kind}:global`);
    assert(!(local && local.until > now && local.count >= (kind === 'login' ? 5 : 8)) && !(global && global.until > now && global.count >= 100), 429, 'TOO_MANY_ATTEMPTS');
  }
  async recordAttempt(storage, kind, client, success) {
    const key = `rate:${kind}:${client}`;
    if (success) { await storage.delete(key); return; }
    for (const name of [key, `rate:${kind}:global`]) {
      const previous = await storage.get(name); const active = previous && previous.until > this.now();
      await storage.put(name, { count: active ? previous.count + 1 : 1, until: active ? previous.until : this.now() + RATE_MS });
    }
    const old = await storage.list({ prefix: 'rate:', limit: 512 });
    for (const [name, value] of old) if (value.until <= this.now()) await storage.delete(name);
  }
  async checkSession(storage, token) {
    const config = await this.authConfig(storage); if (!config || typeof token !== 'string' || token.length > 1024) return undefined;
    try {
      const parts = token.split('.'); if (parts.length !== 2) return undefined;
      const valid = await crypto.subtle.verify('HMAC', await hmacKey(config, ['verify']), unbase64url(parts[1]), bytes(parts[0]));
      if (!valid) return undefined;
      const payload = JSON.parse(decode(unbase64url(parts[0])));
      if (!record(payload) || payload.v !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(payload.sid) || !/^[A-Za-z0-9_-]{43}$/.test(payload.csrf) || !Number.isSafeInteger(payload.exp) || payload.exp <= this.now()) return undefined;
      const stored = await storage.get('session:' + payload.sid);
      if (!stored || stored.exp !== payload.exp || stored.csrf !== payload.csrf || stored.exp <= this.now()) return undefined;
      return payload;
    } catch (error) { if (error instanceof ApiError && error.status === 503) throw error; return undefined; }
  }
  async requireSession(storage, request) {
    const sid = request.headers.get('X-Workspace-Session-Id');
    assert(typeof sid === 'string' && /^[A-Za-z0-9_-]{43}$/.test(sid), 401, 'AUTHENTICATION_REQUIRED');
    const value = await storage.get('session:' + sid);
    assert(value && value.exp > this.now(), 401, 'AUTHENTICATION_REQUIRED'); return sid;
  }
  async requireDevice(storage, request) {
    const hash = request.headers.get('X-Workspace-Device-Hash');
    const device = await storage.get('device:current');
    assert(device && typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash) && device.hash === hash, 401, 'DEVICE_AUTHENTICATION_REQUIRED');
    return device;
  }
  async login(storage, body) {
    assert(record(body) && typeof body.client === 'string' && /^[0-9a-f]{64}$/.test(body.client), 400, 'INVALID_CLIENT');
    await this.rateAllowed(storage, 'login', body.client);
    const config = await this.authConfig(storage); const supplied = typeof body.password === 'string' && body.password.length <= 256 ? body.password : '';
    let valid = false; let active = config;
    if (!config) {
      valid = body.bootstrapOk === true && supplied.length > 0 && body.confirmation === supplied;
      if (valid) {
        const salt = randomToken(); const digest = base64url(await passwordDigest(supplied, salt));
        active = { version: 1, salt, digest, sessionKey: randomToken(), createdAt: this.now() };
        await storage.put('auth:config', active);
      }
    } else if (supplied.length > 0) valid = sameBytes(await passwordDigest(supplied, config.salt), unbase64url(config.digest));
    await this.recordAttempt(storage, 'login', body.client, valid);
    // Commit failed attempts rather than throw (which would roll back the transaction).
    if (!valid) return json({ error: 'INVALID_PASSWORD', message: config ? '私有工作区密码不正确。' : '初次设置未通过，请核对管理密码、私有密码与确认。' }, 401);
    const sessions = await storage.list({ prefix: 'session:', limit: 128 });
    for (const [name, value] of sessions) if (value.exp <= this.now()) await storage.delete(name);
    const payload = { v: 1, sid: randomToken(), csrf: randomToken(), exp: this.now() + SESSION_MS };
    await storage.put('session:' + payload.sid, { csrf: payload.csrf, exp: payload.exp });
    return json({ authenticated: true, csrf: payload.csrf, token: await signedSession(active, payload) });
  }
  async jobResponse(storage, job, statusCode = 200) {
    if (job.status === 'ready') {
      let result;
      if (Object.hasOwn(job, 'result')) result = job.result;
      else if (job.resultRef) result = await readValue(storage, job.resultRef);
      else result = await readValue(storage, 'result:' + job.id); // Previous local/test schema, if present.
      if (result === undefined) return json({ status: 'error', id: job.id, error: '历史读取结果已过期；原操作不会重做，请重新读取当前版本。' });
      return json({ status: 'ready', id: job.id, result }, statusCode);
    }
    if (job.status === 'error' || job.status === 'expired') return json({ status: 'error', id: job.id, error: job.error || '结果已过期，原操作不会重复执行。' });
    if (job.status === 'uncertain') return json({ status: 'uncertain', id: job.id, error: '电脑执行结果尚未确认；保留原请求，等待电脑核对，不会自动重复写入。' });
    return json({ status: 'pending', id: job.id }, statusCode);
  }
  async expireLease(storage) {
    const id = await storage.get('active:job'); if (!id) return;
    const job = await storage.get('job:' + id);
    if (!job || job.status !== 'running') { await storage.delete('active:job'); return; }
    if (job.leaseUntil > this.now()) return;
    job.status = READ_OPS.has(job.op) ? 'pending' : 'uncertain'; job.updatedAt = this.now(); delete job.leaseUntil;
    await storage.put('job:' + id, job); await storage.delete('active:job');
  }
  async pruneJobs(storage, ids) {
    const keep = [];
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index];
      const job = await storage.get('job:' + id); if (!job) continue;
      const old = ['ready', 'error'].includes(job.status) && (job.updatedAt < this.now() - RETENTION_MS || index < ids.length - MAX_RECENT_JOBS);
      if (old) {
        await deleteBlob(storage, 'args:' + id); await deleteBlob(storage, 'result:' + id);
        // Keep the UUID/payload digest for reads as well as writes. A browser can safely
        // repost the original UUID after a lost response without recreating an old operation.
        const { result: _result, resultRef: _resultRef, ...tombstone } = job;
        await storage.put('job:' + id, { ...tombstone, status: 'expired', error: '结果已过期，原操作不会重复执行。' });
      } else keep.push(id);
    }
    return keep;
  }
  async documentCacheKey(storage, args) {
    let version = args.version;
    if (version === undefined) { const state = await readValue(storage, 'published:thesis'); version = state?.blocks.find((block) => block.id === args.id && !block.deletedAt)?.version; }
    return version === undefined ? undefined : 'document:' + await sha256(canonical({ id: args.id, version }));
  }
  async saveDocument(storage, document) {
    const name = 'document:' + await sha256(canonical({ id: document.id, version: document.version }));
    const serialized = boundedJson(document, MAX_RESULT_BYTES); const size = bytes(serialized).byteLength; const hash = await sha256(serialized);
    assert(size <= this.limits.documentBytes, 413, 'DOCUMENT_CACHE_BUDGET_EXCEEDED');
    const previous = await storage.get('documents:index') || []; const existing = previous.find((item) => item.name === name);
    if (existing?.hash) assert(existing.hash === hash, 409, 'DOCUMENT_CACHE_CONFLICT');
    const index = previous.filter((item) => item.name !== name);
    let total = index.reduce((sum, item) => sum + (item.bytes || 0), 0);
    while (index.length && (index.length >= 64 || total + size > this.limits.documentBytes)) { const old = index.shift(); total -= old.bytes || 0; await deleteBlob(storage, old.name); }
    if (!existing) await writeBlob(storage, name, serialized);
    index.push({ name, at: this.now(), bytes: size, hash });
    await storage.put('documents:index', index);
    return name;
  }
  async pendingBytes(storage) {
    let total = await storage.get('queue:bytes');
    if (total === undefined) {
      total = 0;
      for (const id of await storage.get('jobs:index') || []) {
        const job = await storage.get('job:' + id);
        if (job && ['pending', 'running', 'uncertain'].includes(job.status)) total += (await storage.get('blob:args:' + id))?.length || 0;
      }
    }
    assert(Number.isSafeInteger(total) && total >= 0, 500, 'QUEUE_ACCOUNTING_INVALID'); return total;
  }
  async releaseArguments(storage, job) {
    const meta = await storage.get('blob:args:' + job.id);
    if (meta) {
      const total = await this.pendingBytes(storage); assert(total >= meta.length, 500, 'QUEUE_ACCOUNTING_INVALID');
      await deleteBlob(storage, 'args:' + job.id); await storage.put('queue:bytes', total - meta.length);
    }
    delete job.argsBytes;
  }
  async keepResult(storage, job, result) {
    delete job.result; delete job.resultRef;
    if (job.op === 'thesis.state' || job.op === 'thesis.edit') { job.resultRef = 'published:thesis'; return; }
    if (job.op === 'innovation.state' || job.op === 'innovation.change') { job.resultRef = 'published:innovation'; return; }
    if (job.op === 'thesis.document') { job.resultRef = await this.saveDocument(storage, result); return; }
    const serialized = boundedJson(result, MAX_RESULT_BYTES); const size = bytes(serialized).byteLength;
    if (size <= this.limits.inlineBytes) { job.result = result; return; }
    assert(size <= this.limits.temporaryBytes, 413, 'RESULT_CACHE_BUDGET_EXCEEDED');
    const previous = await storage.get('results:index') || []; const index = [];
    for (const entry of previous) {
      if (entry.id === job.id || entry.at <= this.now() - 10 * 60 * 1000) await deleteBlob(storage, 'result:' + entry.id);
      else index.push(entry);
    }
    let total = index.reduce((sum, entry) => sum + entry.bytes, 0);
    while (index.length && (index.length >= 64 || total + size > this.limits.temporaryBytes)) { const old = index.shift(); total -= old.bytes; await deleteBlob(storage, 'result:' + old.id); }
    await writeBlob(storage, 'result:' + job.id, serialized); index.push({ id: job.id, at: this.now(), bytes: size });
    await storage.put('results:index', index); job.resultRef = 'result:' + job.id;
  }
  async rpc(storage, body, owner, session) {
    assert(UUID.test(body.id) && typeof body.op === 'string', 400, 'INVALID_RPC'); rpcArguments(body.op, body.args);
    const payloadHash = await sha256(canonical({ op: body.op, args: body.args }));
    const existing = await storage.get('job:' + body.id);
    if (existing) { assert(existing.owner === owner, 404, 'JOB_NOT_FOUND'); assert(existing.payloadHash === payloadHash, 409, 'REQUEST_ID_CONFLICT'); return this.jobResponse(storage, existing, existing.status === 'pending' || existing.status === 'running' ? 202 : 200); }
    await this.expireLease(storage);
    let ids = await this.pruneJobs(storage, await storage.get('jobs:index') || []); let active = 0;
    for (const id of ids) { const job = await storage.get('job:' + id); if (['pending', 'running', 'uncertain'].includes(job?.status)) active++; }
    assert(active < MAX_ACTIVE_JOBS, 429, 'QUEUE_FULL');
    let cached;
    if (body.op === 'thesis.state') cached = await readValue(storage, 'published:thesis');
    if (body.op === 'innovation.state') cached = await readValue(storage, 'published:innovation');
    if (body.op === 'thesis.document') { const key = await this.documentCacheKey(storage, body.args); if (key) cached = await readValue(storage, key); }
    const job = { id: body.id, op: body.op, owner, session, payloadHash, status: cached === undefined ? 'pending' : 'ready', createdAt: this.now(), updatedAt: this.now(), attempts: 0 };
    if (body.op === 'thesis.document') job.document = { id: body.args.id, ...(body.args.version !== undefined ? { version: body.args.version } : {}) };
    if (cached !== undefined) await this.keepResult(storage, job, cached);
    else {
      const serialized = boundedJson(body.args, MAX_JSON_BYTES); const size = bytes(serialized).byteLength; const total = await this.pendingBytes(storage);
      assert(total + size <= this.limits.pendingBytes, 413, 'QUEUE_BYTES_EXCEEDED', '待确认内容已达到存储上限，请先等电脑确认原请求。');
      await writeBlob(storage, 'args:' + body.id, serialized); job.argsBytes = size; await storage.put('queue:bytes', total + size);
    }
    await storage.put('job:' + body.id, job); ids.push(body.id); await storage.put('jobs:index', ids);
    if (cached !== undefined) return this.jobResponse(storage, job);
    return this.jobResponse(storage, job, 202);
  }
  async complete(storage, body) {
    assert(UUID.test(body.id) && ['ready', 'error'].includes(body.status), 400, 'INVALID_COMPLETION');
    const job = await storage.get('job:' + body.id); assert(job, 404, 'JOB_NOT_FOUND');
    const error = body.status === 'error' ? text(body.error, 2000, 'ERROR', false) : undefined;
    // Request guard survives deletion of large arguments after a definitive completion.
    const args = job.document || (job.op === 'thesis.document' ? await readValue(storage, 'args:' + body.id) : undefined);
    let result = body.result;
    if (body.status === 'ready') {
      if (job.op === 'thesis.state' || job.op === 'thesis.edit') result = cleanThesis(result);
      if (job.op === 'innovation.state' || job.op === 'innovation.change') result = cleanInnovation(result);
      if (job.op === 'thesis.document') {
        assert(record(result) && typeof result.text === 'string' && typeof result.version === 'string' && (job.status === 'expired' || (result.id === args?.id && (args.version === undefined || args.version === result.version))), 409, 'DOCUMENT_VERSION_MISMATCH');
        result = { id: identifier(result.id), version: text(result.version, 200, 'VERSION'), text: result.text };
      }
      if (job.op === 'thesis.manuscript') assert(typeof result === 'string', 400, 'INVALID_MANUSCRIPT');
      if (job.op === 'thesis.importImage') {
        assert(record(result) && /^images\/[0-9a-f]{64}\.(png|jpg|jpeg|webp|gif)$/.test(result.reference), 400, 'INVALID_IMAGE_RESULT');
        assert(await storage.get('image:' + result.reference.slice(7)), 409, 'IMAGE_NOT_UPLOADED');
        result = { reference: result.reference, markdown: text(result.markdown, 2000, 'MARKDOWN'), filePath: '' };
      }
      boundedJson(result, MAX_RESULT_BYTES);
    }
    const resultHash = await sha256(canonical(body.status === 'ready' ? { status: 'ready', result } : { status: 'error', error }));
    if (['ready', 'error', 'expired'].includes(job.status)) { assert(job.completionHash === resultHash, 409, 'COMPLETION_CONFLICT'); return json({ ok: true, duplicate: true }); }
    assert(job.attempts > 0 && ['running', 'uncertain', 'pending'].includes(job.status), 409, 'JOB_NOT_LEASED');
    if (body.status === 'ready') {
      if (job.op === 'thesis.state' || job.op === 'thesis.edit') await writeValue(storage, 'published:thesis', result, MAX_META_BYTES);
      if (job.op === 'innovation.state' || job.op === 'innovation.change') await writeValue(storage, 'published:innovation', result, MAX_META_BYTES);
      await this.keepResult(storage, job, result);
    }
    // Both ready and an explicit error are definitive acknowledgements. Unknown/uncertain
    // jobs never reach this branch and retain their full arguments for desktop recovery.
    await this.releaseArguments(storage, job);
    job.status = body.status; job.error = error; job.updatedAt = this.now(); job.completionHash = resultHash; delete job.leaseUntil;
    await storage.put('job:' + job.id, job);
    if (await storage.get('active:job') === job.id) await storage.delete('active:job');
    return json({ ok: true, duplicate: false });
  }
  async dispatch(request, storage) {
    const path = new URL(request.url).pathname;
    if (path === '/session/status') return json({ needsSetup: !(await this.authConfig(storage)) });
    if (path === '/session/login') return this.login(storage, await readJson(request, 4096));
    if (path === '/session/check') {
      const body = await readJson(request, 2048); const value = await this.checkSession(storage, body.token);
      return json(value ? { authenticated: true, sid: value.sid, csrf: value.csrf } : { authenticated: false });
    }
    if (path === '/device/exchange') {
      const body = await readJson(request, 1024); assert(/^[0-9a-f]{64}$/.test(body.client), 400, 'INVALID_CLIENT');
      await this.rateAllowed(storage, 'pair', body.client);
      const pair = await storage.get('device:pair');
      const ownerSession = pair ? await storage.get('session:' + pair.owner) : undefined;
      const valid = typeof body.code === 'string' && /^\d{8}$/.test(body.code) && pair?.expiresAt > this.now() && ownerSession?.exp > this.now() && pair.hash === await sha256('workspace-pair-v1\n' + body.code);
      await this.recordAttempt(storage, 'pair', body.client, valid);
      if (!valid) return json({ error: 'INVALID_PAIR_CODE', message: '配对码无效或已过期。' }, 401);
      const token = randomToken(); await storage.put('device:current', { hash: await sha256(token), createdAt: this.now() }); await storage.delete('device:pair');
      return json({ token });
    }
    if (path.startsWith('/bridge/') || path.startsWith('/image/write/')) {
      await this.requireDevice(storage, request);
      if (path.startsWith('/image/write/')) {
        assert(request.method === 'PUT', 405, 'METHOD_NOT_ALLOWED');
        const name = path.slice('/image/write/'.length); const data = await readBytes(request, MAX_IMAGE_BYTES); assert(data.length > 0, 400, 'EMPTY_IMAGE');
        const type = imageType(name, data, request.headers.get('Content-Type')); assert(await sha256(data) === type.hash, 422, 'IMAGE_HASH_MISMATCH');
        const existing = await storage.get('image:' + name);
        if (!existing) { await writeBlob(storage, 'image:' + name, data); await storage.put('image:' + name, { mime: type.mime, size: data.length }); }
        else assert(existing.mime === type.mime && existing.size === data.length, 409, 'IMAGE_CONFLICT');
        return json({ ok: true, reference: 'images/' + name, duplicate: !!existing });
      }
      const body = await readJson(request, path === '/bridge/poll' ? 4096 : MAX_JSON_BYTES); assert(record(body), 400, 'INVALID_BODY');
      if (path === '/bridge/publish') {
        assert(body.thesis !== undefined || body.innovation !== undefined, 400, 'EMPTY_PUBLISH');
        if (body.thesis !== undefined) await writeValue(storage, 'published:thesis', cleanThesis(body.thesis), MAX_META_BYTES);
        if (body.innovation !== undefined) await writeValue(storage, 'published:innovation', cleanInnovation(body.innovation), MAX_META_BYTES);
        return json({ ok: true });
      }
      if (path === '/bridge/complete') return this.complete(storage, body);
      if (path === '/bridge/poll') {
        // Heartbeats arriving before expiry extend the one outstanding lease without reissuing it.
        const activeId = await storage.get('active:job'); const activeJob = activeId ? await storage.get('job:' + activeId) : undefined;
        if (body.lease !== undefined) assert(UUID.test(body.lease), 400, 'INVALID_LEASE');
        if (body.lease && activeJob?.id === body.lease && activeJob.status === 'running' && activeJob.leaseUntil > this.now()) { activeJob.leaseUntil = this.now() + LEASE_MS; await storage.put('job:' + activeId, activeJob); }
        await this.expireLease(storage);
        const activity = await storage.get('activity') || {};
        for (const [key, value] of Object.entries(activity)) if (value.until <= this.now()) delete activity[key];
        await storage.put('activity', activity);
        // A heartbeat must never consume a second job, including after completion or lease expiry.
        if (body.lease) return json({ jobs: [], activity: Object.keys(activity).length > 0 });
        if (await storage.get('active:job')) return json({ jobs: [], activity: Object.keys(activity).length > 0 });
        for (const id of await storage.get('jobs:index') || []) {
          const job = await storage.get('job:' + id); if (job?.status !== 'pending') continue;
          job.status = 'running'; job.attempts++; job.leaseUntil = this.now() + LEASE_MS; job.updatedAt = this.now();
          await storage.put('job:' + id, job); await storage.put('active:job', id);
          return json({ jobs: [{ id, op: job.op, args: await readValue(storage, 'args:' + id) }], activity: Object.keys(activity).length > 0 });
        }
        return json({ jobs: [], activity: Object.keys(activity).length > 0 });
      }
      throw new ApiError(404, 'NOT_FOUND');
    }
    const owner = await this.requireSession(storage, request);
    if (path === '/session/logout') {
      await storage.delete('session:' + owner);
      const pair = await storage.get('device:pair'); if (pair?.owner === owner) await storage.delete('device:pair');
      return json({ ok: true });
    }
    if (path === '/device/pair') {
      let random; do { random = crypto.getRandomValues(new Uint32Array(1))[0]; } while (random >= 4200000000);
      const code = String(random % 100000000).padStart(8, '0'); const expiresAt = this.now() + 10 * 60 * 1000;
      await storage.put('device:pair', { hash: await sha256('workspace-pair-v1\n' + code), expiresAt, owner }); return json({ code, expiresAt });
    }
    const body = await readJson(request); assert(record(body), 400, 'INVALID_BODY');
    if (path === '/rpc') return this.rpc(storage, body, OWNER, owner);
    if (path === '/job') {
      assert(UUID.test(body.id), 400, 'INVALID_JOB_ID'); const job = await storage.get('job:' + body.id);
      assert(job?.owner === OWNER, 404, 'JOB_NOT_FOUND'); await this.expireLease(storage);
      return this.jobResponse(storage, await storage.get('job:' + body.id));
    }
    if (path === '/image/read') {
      assert(IMAGE_NAME.test(body.name), 400, 'INVALID_IMAGE_NAME'); const meta = await storage.get('image:' + body.name);
      assert(meta, 404, 'IMAGE_NOT_FOUND'); const data = await readBlob(storage, 'image:' + body.name);
      assert(data?.byteLength === meta.size, 500, 'STORAGE_INCOMPLETE');
      return new Response(data, { headers: privateHeaders({ 'Content-Type': meta.mime, 'Content-Length': String(data.byteLength), 'Content-Security-Policy': "default-src 'none'; sandbox" }) });
    }
    if (path === '/activity') {
      assert(typeof body.tabId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(body.tabId) && typeof body.dirty === 'boolean' && typeof body.syncInput === 'boolean', 400, 'INVALID_ACTIVITY');
      const activity = await storage.get('activity') || {};
      for (const [key, value] of Object.entries(activity)) if (value.until <= this.now()) delete activity[key];
      const key = owner + ':' + body.tabId; assert(activity[key] || Object.keys(activity).length < 64, 429, 'TOO_MANY_TABS');
      activity[key] = { until: this.now() + 30000, dirty: body.dirty, syncInput: body.syncInput }; await storage.put('activity', activity);
      return json({ ok: true });
    }
    throw new ApiError(404, 'NOT_FOUND');
  }
}

// Never expose the Durable Object, assets, binding names, environment or stored state on this Worker.
export default {
  async fetch(request) {
    return new URL(request.url).pathname === '/health' && request.method === 'GET'
      ? json({ ok: true, service: 'private-workspace-state' })
      : json({ error: 'NOT_FOUND' }, 404);
  }
};
