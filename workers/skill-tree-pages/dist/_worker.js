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
      return json({ ok: true, service: 'skill-tree-api-pages' }, request, env);
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

function defaultDomains() {
  return [
    { id: 'core', title: '基础能力', icon: '⌂', color: '#f2c35b' },
    { id: 'perception', title: '感知', icon: '◉', color: '#65d8ff' },
    { id: 'control', title: '控制', icon: '⚙', color: '#86e57e' },
    { id: 'ai', title: 'AI', icon: '◆', color: '#b991ff' },
    { id: 'deploy', title: '工程部署', icon: '▣', color: '#ff9f5d' },
    { id: 'business', title: '表达与商业', icon: '♜', color: '#ffd36b' }
  ];
}

function normalizeDomains(input) {
  const fallback = defaultDomains();
  if (!Array.isArray(input) || !input.length) return fallback;
  const used = new Set();
  return input.slice(0, 18).map((domain, index) => {
    const fallbackDomain = fallback[index % fallback.length];
    let id = trimText(domain.id, 80) || fallbackDomain.id || `domain-${index + 1}`;
    if (used.has(id)) id = `domain-${index + 1}`;
    used.add(id);
    return {
      id,
      title: trimText(domain.title, 80) || fallbackDomain.title || `领域 ${index + 1}`,
      icon: trimText(domain.icon, 8) || fallbackDomain.icon || '◆',
      color: /^#[0-9a-f]{6}$/i.test(domain.color || '') ? domain.color : fallbackDomain.color
    };
  });
}

function normalizeTree(input) {
  const nodes = Array.isArray(input && input.nodes) ? input.nodes : null;
  if (!nodes || nodes.length === 0) {
    throw new Error('INVALID_TREE');
  }

  if (nodes.length > 500) {
    throw new Error('TOO_MANY_NODES');
  }

  const domains = normalizeDomains(input.domains || input.branches);
  const domainIds = domains.map((domain) => domain.id);
  const ids = new Set(nodes.map((node) => trimText(node.id, 80)).filter(Boolean));
  const normalizedNodes = nodes.map((node, index) => {
    const id = trimText(node.id, 80) || `node-${index}`;
    const rawDomains = Array.isArray(node.domains) ? node.domains : [node.branch || domainIds[index % domainIds.length]];
    const nodeDomains = rawDomains.map((item) => trimText(item, 80)).filter((item) => domainIds.includes(item));
    const parents = Array.isArray(node.parents)
      ? node.parents
      : node.parent
        ? [node.parent]
        : [];
    return {
      id,
      parents: [...new Set(parents.map((item) => trimText(item, 80)).filter((item) => item && item !== id && ids.has(item)))],
      title: trimText(node.title, 80) || (index === 0 ? '机器人全栈起点' : '新技能'),
      subtitle: trimText(node.subtitle, 160),
      icon: trimText(node.icon, 8) || domains.find((item) => item.id === nodeDomains[0])?.icon || '✦',
      state: ['locked', 'current', 'done', 'master'].includes(node.state) ? node.state : 'current',
      domains: nodeDomains.length ? nodeDomains : [domainIds[0]],
      x: clampNumber(node.x, 120, 3480, 600 + index * 80),
      y: clampNumber(node.y, 90, 2310, 460 + index * 60),
      perk: trimText(node.perk, 140),
      link: trimText(node.link, 500),
      notes: trimText(node.notes, 1200)
    };
  });

  if (!normalizedNodes.some((node) => node.id === 'root')) {
    normalizedNodes[0].id = 'root';
    normalizedNodes[0].parents = [];
  }

  const validIds = new Set(normalizedNodes.map((node) => node.id));
  normalizedNodes.forEach((node) => {
    if (node.id === 'root') {
      node.parents = [];
    } else {
      node.parents = node.parents.filter((parentId) => validIds.has(parentId));
      if (!node.parents.length) node.parents = ['root'];
    }
  });

  return {
    version: 3,
    layout: 'free-cross-tree',
    selectedId: trimText(input.selectedId, 80) || 'root',
    view: {
      x: clampNumber(input.view && input.view.x, -4000, 4000, 0),
      y: clampNumber(input.view && input.view.y, -4000, 4000, 0),
      scale: clampNumber(input.view && input.view.scale, 0.35, 1.65, 0.78)
    },
    domains,
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
