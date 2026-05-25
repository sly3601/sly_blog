const TREE_KEY = 'skill-tree:current';
const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://sly3601.github.io',
  'http://localhost:4000',
  'http://localhost:4002',
  'http://localhost:4003'
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'skill-tree-api' }, request, env);
    }

    if (url.pathname !== '/skill-tree') {
      return json({ ok: false, error: 'NOT_FOUND' }, request, env, 404);
    }

    if (!env.SKILL_TREE_KV) {
      return json({ ok: false, error: 'KV_NOT_CONFIGURED' }, request, env, 500);
    }

    if (request.method === 'GET') {
      const raw = await env.SKILL_TREE_KV.get(TREE_KEY);
      if (!raw) {
        return json({ ok: false, error: 'TREE_NOT_FOUND' }, request, env, 404);
      }

      return json(JSON.parse(raw), request, env);
    }

    if (request.method === 'PUT' || request.method === 'POST') {
      const authResult = authorize(request, env);
      if (!authResult.ok) {
        return json({ ok: false, error: authResult.error }, request, env, authResult.status);
      }

      let tree;
      try {
        const body = await readJsonBody(request);
        tree = normalizeTree(body);
      } catch (error) {
        return json({ ok: false, error: error.message || 'INVALID_REQUEST' }, request, env, 400);
      }
      tree.updatedAt = new Date().toISOString();

      await env.SKILL_TREE_KV.put(TREE_KEY, JSON.stringify(tree));
      return json({ ok: true, tree }, request, env);
    }

    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, request, env, 405);
  }
};

function authorize(request, env) {
  const expected = String(env.ADMIN_TOKEN || '').trim();
  if (!expected) {
    return { ok: false, error: 'ADMIN_TOKEN_NOT_CONFIGURED', status: 500 };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = bearer || request.headers.get('x-admin-token') || '';

  if (token !== expected) {
    return { ok: false, error: 'UNAUTHORIZED', status: 401 };
  }

  return { ok: true };
}

async function readJsonBody(request) {
  const size = Number(request.headers.get('content-length') || 0);
  if (size > MAX_BODY_BYTES) {
    throw new Error('REQUEST_TOO_LARGE');
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new Error('REQUEST_TOO_LARGE');
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('INVALID_JSON');
  }
}

function normalizeTree(input) {
  const nodes = Array.isArray(input && input.nodes) ? input.nodes : null;
  if (!nodes || nodes.length === 0) {
    throw new Error('INVALID_TREE');
  }

  if (nodes.length > 500) {
    throw new Error('TOO_MANY_NODES');
  }

  const ids = new Set();
  const normalizedNodes = nodes.map((node, index) => {
    const id = trimText(node.id, 80) || `node-${index}`;
    ids.add(id);
    return {
      id,
      parent: node.parent === null || node.parent === undefined ? null : trimText(node.parent, 80),
      title: trimText(node.title, 80) || (index === 0 ? '原点' : '新技能'),
      subtitle: trimText(node.subtitle, 140),
      icon: trimText(node.icon, 8) || '✦',
      state: ['locked', 'current', 'done', 'master'].includes(node.state) ? node.state : 'current',
      link: trimText(node.link, 500),
      notes: trimText(node.notes, 1000),
      x: clampNumber(node.x, 120, 3080, 1600),
      y: clampNumber(node.y, 80, 2120, 1100)
    };
  });

  if (!ids.has('root')) {
    normalizedNodes[0].id = 'root';
    normalizedNodes[0].parent = null;
    ids.add('root');
  }

  normalizedNodes.forEach((node) => {
    if (node.id === 'root') {
      node.parent = null;
    } else if (!node.parent || !ids.has(node.parent)) {
      node.parent = 'root';
    }
  });

  return {
    version: 1,
    selectedId: trimText(input.selectedId, 80) || 'root',
    view: {
      x: clampNumber(input.view && input.view.x, -4000, 4000, 0),
      y: clampNumber(input.view && input.view.y, -4000, 4000, 0),
      scale: clampNumber(input.view && input.view.scale, 0.35, 1.65, 0.8)
    },
    nodes: normalizedNodes
  };
}

function trimText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function json(payload, request, env, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env)
    }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const allowOrigin = origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))
    ? origin
    : allowedOrigins[0] || '*';

  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, x-admin-token',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}
