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

    if (url.pathname === '/github-contributions' || url.pathname === '/github-contributions.svg') {
      return githubContributionsSvg(request, env, url);
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

async function githubContributionsSvg(request, env, url) {
  const username = sanitizeGithubUser(url.searchParams.get('user') || 'sly3601');
  const color = sanitizeHexColor(url.searchParams.get('color') || 'ffc1da');

  try {
    const response = await fetch(`https://github.com/users/${username}/contributions`, {
      headers: {
        accept: 'text/html',
        'user-agent': 'sly-blog-contribution-widget'
      }
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    const html = await response.text();
    const days = parseContributionDays(html);
    if (!days.length) throw new Error('NO_CONTRIBUTION_DAYS');
    const total = parseContributionTotal(html);
    return svgResponse(renderContributionSvg({ username, color, days, total }), request, env, 600);
  } catch (error) {
    return svgResponse(renderContributionFallback(username), request, env, 60);
  }
}

function parseContributionDays(html) {
  const tags = html.match(/<td\b[^>]*ContributionCalendar-day[^>]*>/g) || [];
  return tags.map((tag, index) => {
    const date = readAttr(tag, 'data-date');
    const id = readAttr(tag, 'id');
    const idMatch = id.match(/contribution-day-component-(\d+)-(\d+)/);
    return {
      date,
      level: clampNumber(readAttr(tag, 'data-level'), 0, 4, 0),
      row: idMatch ? Number(idMatch[1]) : index % 7,
      col: idMatch ? Number(idMatch[2]) : Math.floor(index / 7)
    };
  }).filter((day) => day.date);
}

function parseContributionTotal(html) {
  const heading = /id="js-contribution-activity-description"[^>]*>([\s\S]*?)<\/h2>/.exec(html);
  const text = (heading ? heading[1] : html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const match = text.match(/([\d,]+)\s+contributions/i);
  return match ? match[1] : '';
}

function renderContributionSvg({ username, color, days, total }) {
  const cell = 10;
  const gap = 3;
  const step = cell + gap;
  const left = 30;
  const top = 24;
  const maxCol = Math.max(...days.map((day) => day.col), 52);
  const width = left + (maxCol + 1) * step + 14;
  const height = 124;
  const colors = buildPinkPalette(color);
  const monthLabels = buildMonthLabels(days);
  const rowLabels = [
    { row: 1, text: 'Mon' },
    { row: 3, text: 'Wed' },
    { row: 5, text: 'Fri' }
  ];

  const rects = days.map((day) => {
    const x = left + day.col * step;
    const y = top + day.row * step;
    const fill = colors[day.level] || colors[0];
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${escapeXml(day.date)}: level ${day.level}</title></rect>`;
  }).join('');

  const months = monthLabels.map((label) =>
    `<text x="${left + label.col * step}" y="12" class="month">${escapeXml(label.text)}</text>`
  ).join('');
  const rows = rowLabels.map((label) =>
    `<text x="0" y="${top + label.row * step + 9}" class="label">${label.text}</text>`
  ).join('');
  const totalText = total ? `${escapeXml(total)} contributions in the last year` : `GitHub contributions`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(username)} GitHub contribution calendar">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
    .month, .label { fill: #9b7284; font-size: 10px; }
    .summary { fill: #8f5570; font-size: 11px; font-weight: 700; }
  </style>
  <rect width="100%" height="100%" rx="10" fill="#fffafb"/>
  ${months}
  ${rows}
  ${rects}
  <text x="${left}" y="116" class="summary">${totalText}</text>
</svg>`;
}

function buildMonthLabels(days) {
  const rowZero = days.filter((day) => day.row === 0).sort((a, b) => a.col - b.col);
  const labels = [];
  let lastMonth = '';
  rowZero.forEach((day) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const month = `${date.getUTCMonth() + 1}月`;
    if (month !== lastMonth) {
      labels.push({ col: day.col, text: month });
      lastMonth = month;
    }
  });
  return labels;
}

function buildPinkPalette(hex) {
  const base = `#${hex}`;
  return ['#f5edf2', '#ffe5ef', base, '#ff91bd', '#d95d97'];
}

function renderContributionFallback(username) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="124" viewBox="0 0 700 124" role="img" aria-label="GitHub contribution calendar unavailable">
  <rect width="100%" height="100%" rx="10" fill="#fffafb"/>
  <text x="24" y="56" fill="#8f5570" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="14" font-weight="700">暂时没有读到 @${escapeXml(username)} 的 GitHub 贡献图</text>
  <text x="24" y="80" fill="#9b7284" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12">刷新后会自动重试。</text>
</svg>`;
}

function svgResponse(svg, request, env, maxAge) {
  return new Response(svg, {
    headers: {
      ...corsHeaders(request, env),
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}, s-maxage=${maxAge}`
    }
  });
}

function sanitizeGithubUser(value) {
  const username = String(value || '').trim();
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username) ? username : 'sly3601';
}

function sanitizeHexColor(value) {
  const color = String(value || '').trim().replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : 'ffc1da';
}

function readAttr(tag, name) {
  const match = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : '';
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
