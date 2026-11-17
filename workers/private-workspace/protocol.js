// Shared, dependency-free protocol helpers. No private data belongs in this source tree.
export const API_PREFIX = '/workspace-api';
export const CHUNK_BYTES = 64 * 1024;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_JSON_BYTES = 32 * 1024 * 1024;
export const MAX_RESULT_BYTES = 24 * 1024 * 1024;
export const MAX_META_BYTES = 4 * 1024 * 1024;
export const STORAGE_LIMITS = Object.freeze({ pendingBytes: 32 * 1024 * 1024, documentBytes: 128 * 1024 * 1024, temporaryBytes: 32 * 1024 * 1024, inlineBytes: 32 * 1024 });
export const SESSION_SECONDS = 24 * 60 * 60;
export const LEASE_MS = 60 * 1000;
export const OPS = new Set(['thesis.state', 'thesis.document', 'thesis.edit', 'thesis.importImage', 'thesis.manuscript', 'innovation.state', 'innovation.change']);
export const READ_OPS = new Set(['thesis.state', 'thesis.document', 'thesis.manuscript', 'innovation.state']);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const IMAGE_NAME = /^([0-9a-f]{64})\.(png|jpg|jpeg|webp|gif)$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export class ApiError extends Error {
  constructor(status, code, message = code) { super(message); this.status = status; this.code = code; }
}
export function assert(condition, status, code, message) {
  if (!condition) throw new ApiError(status, code, message);
}
export function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function text(value, max, name, empty = true) {
  assert(typeof value === 'string' && value.length <= max && (empty || value.length > 0), 400, 'INVALID_' + name);
  return value;
}
export function identifier(value, name = 'ID') { return text(value, 200, name, false); }
export function integer(value, min, max, name) {
  assert(Number.isSafeInteger(value) && value >= min && value <= max, 400, 'INVALID_' + name);
  return value;
}
export function bytes(value) { return typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value); }
export function decode(value) { try { return decoder.decode(value); } catch { throw new ApiError(400, 'INVALID_UTF8'); } }
export function privateHeaders(extra = {}) {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache', Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    ...extra
  };
}
export function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: privateHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...extra }) });
}
export function failure(error) {
  if (error instanceof ApiError) return json({ error: error.code, message: error.message }, error.status, error.status === 429 ? { 'Retry-After': '900' } : {});
  // Never expose stack traces, credentials, storage keys, request bodies or arbitrary exception text.
  return json({ error: 'INTERNAL_ERROR', message: '私有工作区暂时不可用，请稍后核对原请求。' }, 500);
}
export async function readBytes(request, limit) {
  const declared = request.headers.get('Content-Length');
  if (declared !== null) assert(/^\d+$/.test(declared) && Number(declared) <= limit, 413, 'BODY_TOO_LARGE');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(); const parts = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new ApiError(413, 'BODY_TOO_LARGE'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}
export async function readJson(request, limit = MAX_JSON_BYTES) {
  const body = await readBytes(request, limit);
  try { return JSON.parse(decode(body)); } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'INVALID_JSON');
  }
}
export function boundedJson(value, limit) {
  let serialized;
  try { serialized = JSON.stringify(value); } catch { throw new ApiError(400, 'INVALID_JSON'); }
  assert(typeof serialized === 'string' && bytes(serialized).byteLength <= limit, 413, 'JSON_TOO_LARGE');
  return serialized;
}
export function canonical(value, depth = 0) {
  assert(depth <= 40, 400, 'JSON_TOO_DEEP');
  if (Array.isArray(value)) return '[' + value.map((item) => canonical(item, depth + 1)).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key], depth + 1)).join(',') + '}';
  assert(value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)), 400, 'INVALID_JSON_VALUE');
  return JSON.stringify(value);
}
export async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value)))].map((n) => n.toString(16).padStart(2, '0')).join('');
}
export function randomToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
export function base64url(value) {
  let binary = ''; for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unbase64url(value) {
  assert(typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value), 400, 'INVALID_ENCODING');
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
export function imageType(name, data, contentType) {
  const match = IMAGE_NAME.exec(name); assert(match, 400, 'INVALID_IMAGE_NAME');
  const extension = match[2]; const mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/' + extension;
  assert(contentType?.split(';')[0].trim().toLowerCase() === mime, 415, 'INVALID_IMAGE_TYPE');
  let valid = false;
  if (extension === 'png') valid = data.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => data[i] === n);
  if (extension === 'jpg' || extension === 'jpeg') valid = data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255;
  if (extension === 'gif') valid = data.length >= 6 && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...data.subarray(0, 6)));
  if (extension === 'webp') valid = data.length >= 12 && String.fromCharCode(...data.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...data.subarray(8, 12)) === 'WEBP';
  assert(valid, 415, 'IMAGE_SIGNATURE_MISMATCH');
  return { mime, hash: match[1] };
}
