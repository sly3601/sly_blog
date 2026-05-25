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

function defaultBranches() {
  return [
    { id: 'core', title: '殖民基础', icon: '⌂', color: '#f2c35b' },
    { id: 'perception', title: '机器人感知', icon: '◉', color: '#6fd1ff' },
    { id: 'control', title: '运动控制', icon: '⚙', color: '#83df7a' },
    { id: 'ai', title: 'AI 工程', icon: '◆', color: '#b18cff' },
    { id: 'deploy', title: '系统部署', icon: '▣', color: '#ff9f5d' },
    { id: 'business', title: '知识付费', icon: '♜', color: '#ffcf6d' }
  ];
}

function defaultTiers() {
  return [
    { level: 1, title: 'Tier 1', morale: '+0' },
    { level: 2, title: 'Tier 2', morale: '+1' },
    { level: 3, title: 'Tier 3', morale: '+2' },
    { level: 4, title: 'Tier 4', morale: '+4' },
    { level: 5, title: 'Tier 5', morale: '+6' },
    { level: 6, title: 'Tier 6', morale: '+8' }
  ];
}

function normalizeBranches(input) {
  const fallback = defaultBranches();
  if (!Array.isArray(input) || !input.length) return fallback;
  const used = new Set();
  return input.slice(0, 10).map((branch, index) => {
    const fallbackBranch = fallback[index % fallback.length];
    let id = trimText(branch.id, 80) || fallbackBranch.id || `branch-${index + 1}`;
    if (used.has(id)) id = `branch-${index + 1}`;
    used.add(id);
    return {
      id,
      title: trimText(branch.title, 80) || fallbackBranch.title || `分支 ${index + 1}`,
      icon: trimText(branch.icon, 8) || fallbackBranch.icon || '◆',
      color: /^#[0-9a-f]{6}$/i.test(branch.color || '') ? branch.color : fallbackBranch.color
    };
  });
}

function normalizeTiers(input) {
  if (!Array.isArray(input) || !input.length) return defaultTiers();
  return input.slice(0, 8).map((tier, index) => ({
    level: index + 1,
    title: trimText(tier.title, 40) || `Tier ${index + 1}`,
    morale: trimText(tier.morale, 12) || `+${index}`
  }));
}

function normalizeTree(input) {
  const nodes = Array.isArray(input && input.nodes) ? input.nodes : null;
  if (!nodes || nodes.length === 0) {
    throw new Error('INVALID_TREE');
  }

  if (nodes.length > 500) {
    throw new Error('TOO_MANY_NODES');
  }

  const branches = normalizeBranches(input.branches);
  const tiers = normalizeTiers(input.tiers);
  const branchIds = branches.map((branch) => branch.id);
  const ids = new Set();
  const normalizedNodes = nodes.map((node, index) => {
    const id = trimText(node.id, 80) || `node-${index}`;
    const branch = branchIds.includes(node.branch) ? node.branch : branchIds[index % branchIds.length];
    ids.add(id);
    return {
      id,
      parent: node.parent === null || node.parent === undefined ? null : trimText(node.parent, 80),
      title: trimText(node.title, 80) || (index === 0 ? '基地入门' : '新技能'),
      subtitle: trimText(node.subtitle, 140),
      icon: trimText(node.icon, 8) || branches.find((item) => item.id === branch).icon || '◆',
      state: ['locked', 'current', 'done', 'master'].includes(node.state) ? node.state : 'current',
      branch,
      tier: clampNumber(node.tier, 1, tiers.length, 1),
      slot: clampNumber(node.slot, 0, 20, 0),
      perk: trimText(node.perk, 120),
      link: trimText(node.link, 500),
      notes: trimText(node.notes, 1000),
      x: clampNumber(node.x, 0, 6000, 0),
      y: clampNumber(node.y, 0, 4000, 0)
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
    version: 2,
    layout: 'oni-grid',
    selectedId: trimText(input.selectedId, 80) || 'root',
    view: {
      x: clampNumber(input.view && input.view.x, -4000, 4000, 0),
      y: clampNumber(input.view && input.view.y, -4000, 4000, 0),
      scale: clampNumber(input.view && input.view.scale, 0.35, 1.65, 0.8)
    },
    branches,
    tiers,
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
