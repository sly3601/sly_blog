const TREE_KEY = 'skill-tree:current';
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_GITHUB_OWNER = 'sly3601';
const DEFAULT_GITHUB_REPO = 'sly_blog';
const DEFAULT_GITHUB_BRANCH = 'main';
const POSTS_DIR = 'source/_posts';
const DEFAULT_IMAGE_PREFIX = 'blog';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BODY_BYTES = 14 * 1024 * 1024;
const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
const DEFAULT_ALLOWED_ORIGINS = [
  'https://sly3601.github.io',
  'https://sly-blog.pages.dev',
  'http://localhost:4000',
  'http://localhost:4002',
  'http://localhost:4003',
  'http://127.0.0.1:4012'
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

    if (url.pathname === '/github-contributions' || url.pathname === '/github-contributions.svg') {
      return githubContributionsSvg(request, env, url);
    }

    if (url.pathname === '/blog-posts') {
      return blogPosts(request, env);
    }

    if (url.pathname === '/blog-images' || url.pathname.startsWith('/blog-images/')) {
      return blogImages(request, env);
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

async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  const size = Number(request.headers.get('content-length') || 0);
  if (size > maxBytes) {
    throw new Error('REQUEST_TOO_LARGE');
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    throw new Error('REQUEST_TOO_LARGE');
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('INVALID_JSON');
  }
}

async function blogImages(request, env) {
  const see = seeConfig(env);
  const r2 = r2Config(request, env);

  if (request.method === 'GET') {
    if (urlImageKey(new URL(request.url))) {
      return readImageFromR2(request, env);
    }

    const cos = cosConfig(env);
    return json({
      ok: true,
      service: 'blog-images',
      configured: Boolean(see || r2 || cos),
      storage: see ? 'see' : (r2 ? 'r2' : (cos ? 'cos' : '')),
      maxBytes: MAX_IMAGE_BYTES
    }, request, env);
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, request, env, 405);
  }

  const authResult = authorize(request, env);
  if (!authResult.ok) {
    return json({ ok: false, error: authResult.error }, request, env, authResult.status);
  }

  const cos = cosConfig(env);
  if (!see && !r2 && !cos) {
    return json({ ok: false, error: 'IMAGE_STORAGE_NOT_CONFIGURED' }, request, env, 500);
  }

  let image;
  try {
    image = normalizeImageUpload(await readJsonBody(request, MAX_IMAGE_BODY_BYTES), see || r2 || cos);
  } catch (error) {
    return json({ ok: false, error: error.message || 'INVALID_REQUEST' }, request, env, 400);
  }

  try {
    const result = see
      ? await uploadImageToSee(image, see)
      : r2
      ? await uploadImageToR2(image, r2)
      : await uploadImageToCos(image, cos);
    return json({ ok: true, ...result }, request, env);
  } catch (error) {
    const status = error.status || 500;
    return json({ ok: false, error: error.message || 'IMAGE_UPLOAD_FAILED' }, request, env, status);
  }
}

async function blogPosts(request, env) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const action = url.searchParams.get('action') || '';
    if (action === 'list' || action === 'read') {
      const authResult = authorize(request, env);
      if (!authResult.ok) {
        return json({ ok: false, error: authResult.error }, request, env, authResult.status);
      }
      if (!String(env.GITHUB_TOKEN || '').trim()) {
        return json({ ok: false, error: 'GITHUB_TOKEN_NOT_CONFIGURED' }, request, env, 500);
      }

      try {
        if (action === 'list') {
          const result = await listPostsFromGithub(env);
          return json({ ok: true, ...result }, request, env);
        }

        const postPath = normalizePostPath(url.searchParams.get('path') || url.searchParams.get('filename'));
        if (!postPath) return json({ ok: false, error: 'POST_PATH_REQUIRED' }, request, env, 400);
        const result = await readPostFromGithub(postPath, env);
        return json({ ok: true, ...result }, request, env);
      } catch (error) {
        const status = error.status || 500;
        return json({ ok: false, error: error.message || 'GITHUB_READ_FAILED' }, request, env, status);
      }
    }

    return json({
      ok: true,
      service: 'blog-posts',
      owner: env.GITHUB_OWNER || DEFAULT_GITHUB_OWNER,
      repo: env.GITHUB_REPO || DEFAULT_GITHUB_REPO,
      branch: env.GITHUB_BRANCH || DEFAULT_GITHUB_BRANCH,
      path: POSTS_DIR
    }, request, env);
  }

  if (request.method === 'DELETE') {
    const authResult = authorize(request, env);
    if (!authResult.ok) {
      return json({ ok: false, error: authResult.error }, request, env, authResult.status);
    }

    if (!String(env.GITHUB_TOKEN || '').trim()) {
      return json({ ok: false, error: 'GITHUB_TOKEN_NOT_CONFIGURED' }, request, env, 500);
    }

    const postPath = normalizePostPath(url.searchParams.get('path') || url.searchParams.get('filename'));
    if (!postPath) return json({ ok: false, error: 'POST_PATH_REQUIRED' }, request, env, 400);

    try {
      const result = await deletePostFromGithub(postPath, env);
      return json({ ok: true, ...result }, request, env);
    } catch (error) {
      const status = error.status || 500;
      return json({ ok: false, error: error.message || 'GITHUB_DELETE_FAILED' }, request, env, status);
    }
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, request, env, 405);
  }

  const authResult = authorize(request, env);
  if (!authResult.ok) {
    return json({ ok: false, error: authResult.error }, request, env, authResult.status);
  }

  if (!String(env.GITHUB_TOKEN || '').trim()) {
    return json({ ok: false, error: 'GITHUB_TOKEN_NOT_CONFIGURED' }, request, env, 500);
  }

  let post;
  try {
    post = normalizePost(await readJsonBody(request));
  } catch (error) {
    return json({ ok: false, error: error.message || 'INVALID_REQUEST' }, request, env, 400);
  }

  try {
    const result = await savePostToGithub(post, env);
    return json({ ok: true, ...result }, request, env);
  } catch (error) {
    const status = error.status || 500;
    return json({ ok: false, error: error.message || 'GITHUB_WRITE_FAILED' }, request, env, status);
  }
}

function normalizePost(input) {
  const title = trimText(input && input.title, 120);
  if (!title) throw new Error('TITLE_REQUIRED');

  const markdown = String((input && input.markdown) || '').trim();
  if (!markdown) throw new Error('BODY_REQUIRED');

  const tags = Array.isArray(input.tags)
    ? input.tags.map((tag) => trimText(tag, 50)).filter(Boolean).slice(0, 20)
    : [];
  const category = trimText(input.category, 50) || '日记';
  const sourcePath = normalizePostPath(input.sourcePath);
  const filename = sourcePath ? sourcePath.split('/').pop() : `${sanitizeFilename(input.slug || title)}.md`;
  const date = sanitizeDate(input.date) || formatDate(new Date());
  const description = trimText(input.description, 220);
  const cover = trimText(input.cover, 500);

  return {
    filename,
    path: sourcePath || `${POSTS_DIR}/${filename}`,
    sourcePath,
    date,
    updated: formatDate(new Date()),
    category,
    tags,
    cover,
    description,
    markdown,
    title,
    overwrite: Boolean(input.overwrite || sourcePath)
  };
}

function buildPostMarkdown(post, existingMeta = {}) {
  const lines = [
    '---',
    `title: ${yamlString(post.title)}`,
    `date: ${yamlString(post.date)}`,
    `updated: ${yamlString(post.updated)}`,
    'categories:',
    `  - ${yamlString(post.category)}`
  ];

  if (post.tags.length) {
    lines.push('tags:', ...post.tags.map((tag) => `  - ${yamlString(tag)}`));
  }
  if (post.cover) lines.push(`cover: ${yamlString(post.cover)}`);
  if (post.description) lines.push(`description: ${yamlString(post.description)}`);

  const managedKeys = new Set(['title', 'date', 'updated', 'categories', 'category', 'tags', 'cover', 'description']);
  Object.entries(existingMeta || {}).forEach(([key, value]) => {
    if (!key || managedKeys.has(key)) return;
    lines.push(...formatYamlEntry(key, value));
  });

  lines.push('---', '', post.markdown.trim(), '');
  return lines.join('\n');
}

async function listPostsFromGithub(env) {
  const { owner, repo, branch } = githubRepoConfig(env);
  const endpoint = githubContentsEndpoint(owner, repo, POSTS_DIR);
  const headers = githubHeaders(env);
  const response = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  const items = await response.json().catch(() => []);

  if (!response.ok) {
    throw httpError((items && items.message) || 'GITHUB_READ_FAILED', response.status);
  }

  const files = Array.isArray(items)
    ? items.filter((item) => item && item.type === 'file' && /\.md$/i.test(item.name)).slice(0, 120)
    : [];

  const posts = await Promise.all(files.map(async (item) => {
    try {
      const post = await readPostFromGithub(item.path, env);
      return {
        path: item.path,
        filename: item.name,
        title: post.meta.title || item.name.replace(/\.md$/i, ''),
        date: post.meta.date || '',
        updated: post.meta.updated || '',
        category: post.meta.category || '',
        tags: post.meta.tags || [],
        sha: item.sha || '',
        htmlUrl: item.html_url || ''
      };
    } catch (error) {
      return {
        path: item.path,
        filename: item.name,
        title: item.name.replace(/\.md$/i, ''),
        date: '',
        updated: '',
        category: '',
        tags: [],
        sha: item.sha || '',
        htmlUrl: item.html_url || ''
      };
    }
  }));

  posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.filename.localeCompare(b.filename, 'zh-Hans-CN'));
  return { posts, branch, path: POSTS_DIR };
}

async function readPostFromGithub(postPath, env) {
  const normalizedPath = normalizePostPath(postPath);
  if (!normalizedPath) throw httpError('POST_PATH_REQUIRED', 400);

  const { owner, repo, branch } = githubRepoConfig(env);
  const endpoint = githubContentsEndpoint(owner, repo, normalizedPath);
  const response = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders(env) });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw httpError((data && data.message) || 'GITHUB_READ_FAILED', response.status);
  }

  const raw = utf8FromBase64(data.content || '');
  const parsed = parsePostContent(raw);
  return {
    path: normalizedPath,
    filename: normalizedPath.split('/').pop(),
    sha: data.sha || '',
    htmlUrl: data.html_url || '',
    meta: postMetaForClient(parsed.meta),
    markdown: parsed.markdown,
    raw
  };
}

async function savePostToGithub(post, env) {
  const { owner, repo, branch } = githubRepoConfig(env);
  const endpoint = githubContentsEndpoint(owner, repo, post.path);
  const headers = githubHeaders(env);

  let sha = '';
  let existingMeta = {};
  const existing = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha || '';
    if (!post.overwrite) throw httpError('FILE_EXISTS', 409);
    existingMeta = parsePostContent(utf8FromBase64(data.content || '')).meta;
  } else if (existing.status !== 404) {
    throw httpError('GITHUB_READ_FAILED', existing.status);
  }

  const content = buildPostMarkdown(post, existingMeta);
  const body = {
    message: `${sha ? 'Update' : 'Publish'} post: ${post.title}`,
    content: base64FromUtf8(content),
    branch
  };
  if (sha) body.sha = sha;

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(result.message || 'GITHUB_WRITE_FAILED', response.status);
  }

  return {
    path: post.path,
    branch,
    htmlUrl: result.content && result.content.html_url,
    commitUrl: result.commit && result.commit.html_url
  };
}

async function deletePostFromGithub(postPath, env) {
  const normalizedPath = normalizePostPath(postPath);
  if (!normalizedPath) throw httpError('POST_PATH_REQUIRED', 400);

  const { owner, repo, branch } = githubRepoConfig(env);
  const endpoint = githubContentsEndpoint(owner, repo, normalizedPath);
  const headers = githubHeaders(env);
  const existing = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  const data = await existing.json().catch(() => ({}));

  if (!existing.ok) {
    if (existing.status === 404) throw httpError('POST_NOT_FOUND', 404);
    throw httpError((data && data.message) || 'GITHUB_READ_FAILED', existing.status);
  }
  if (!data.sha) throw httpError('GITHUB_READ_FAILED', 500);

  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({
      message: `Delete post: ${normalizedPath.split('/').pop()}`,
      sha: data.sha,
      branch
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(result.message || 'GITHUB_DELETE_FAILED', response.status);
  }

  return {
    path: normalizedPath,
    branch,
    commitUrl: result.commit && result.commit.html_url
  };
}

function cosConfig(env) {
  const secretId = trimText(env.TENCENT_COS_SECRET_ID || env.COS_SECRET_ID, 200);
  const secretKey = trimText(env.TENCENT_COS_SECRET_KEY || env.COS_SECRET_KEY, 200);
  const bucket = trimText(env.TENCENT_COS_BUCKET || env.COS_BUCKET, 160);
  const region = trimText(env.TENCENT_COS_REGION || env.COS_REGION, 80);
  if (!secretId || !secretKey || !bucket || !region) return null;
  if (!/^[a-z0-9][a-z0-9-]*-\d+$/i.test(bucket)) return null;
  if (!/^[a-z0-9-]+$/i.test(region)) return null;

  const publicBaseUrl = trimText(env.TENCENT_COS_PUBLIC_BASE_URL || env.COS_PUBLIC_BASE_URL, 500);
  const prefix = normalizeObjectPrefix(env.TENCENT_COS_UPLOAD_PREFIX || env.COS_UPLOAD_PREFIX || DEFAULT_IMAGE_PREFIX);
  const host = `${bucket}.cos.${region}.myqcloud.com`;

  return {
    secretId,
    secretKey,
    bucket,
    region,
    host,
    prefix,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, '')
  };
}

function r2Config(request, env) {
  if (!env.BLOG_IMAGES_BUCKET) return null;
  const publicBaseUrl = trimText(env.R2_PUBLIC_BASE_URL, 500).replace(/\/+$/, '')
    || `${new URL(request.url).origin}/blog-images`;
  const prefix = normalizeObjectPrefix(env.R2_UPLOAD_PREFIX || env.TENCENT_COS_UPLOAD_PREFIX || env.COS_UPLOAD_PREFIX || DEFAULT_IMAGE_PREFIX);
  return {
    bucket: env.BLOG_IMAGES_BUCKET,
    publicBaseUrl,
    prefix
  };
}

function seeConfig(env) {
  const token = trimText(env.S_EE_API_KEY || env.SEE_API_KEY || env.SMMS_TOKEN || env.SM_MS_TOKEN, 500);
  if (!token) return null;
  return {
    token,
    domain: trimText(env.S_EE_DOMAIN || '', 80),
    prefix: normalizeObjectPrefix(env.S_EE_UPLOAD_PREFIX || DEFAULT_IMAGE_PREFIX)
  };
}

function normalizeImageUpload(input, config) {
  const contentType = normalizeImageContentType(input && input.contentType);
  if (!contentType) throw new Error('IMAGE_TYPE_NOT_ALLOWED');

  const base64 = String((input && input.content) || '')
    .replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '')
    .replace(/\s/g, '');
  if (!base64) throw new Error('IMAGE_BODY_REQUIRED');
  if (Number(input && input.size) > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');

  let bytes;
  try {
    bytes = bytesFromBase64(base64);
  } catch (error) {
    throw new Error('IMAGE_BODY_REQUIRED');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');

  const extension = IMAGE_TYPES[contentType];
  const key = imageObjectKey(input && input.filename, extension, config.prefix);

  return {
    bytes,
    key,
    contentType,
    filename: key.split('/').pop()
  };
}

async function uploadImageToCos(image, config) {
  const path = `/${image.key}`;
  const uploadUrl = `https://${config.host}${path}`;
  const cacheControl = 'public, max-age=31536000, immutable';
  const signedHeaders = {
    host: config.host,
    'content-type': image.contentType,
    'cache-control': cacheControl
  };
  const authorization = await tencentCosAuthorization({
    method: 'PUT',
    path,
    headers: signedHeaders,
    secretId: config.secretId,
    secretKey: config.secretKey
  });

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': image.contentType,
      'Cache-Control': cacheControl
    },
    body: image.bytes
  });

  if (!response.ok) {
    throw httpError('COS_UPLOAD_FAILED', response.status);
  }

  const publicBase = config.publicBaseUrl || `https://${config.host}`;
  return {
    key: image.key,
    filename: image.filename,
    contentType: image.contentType,
    size: image.bytes.byteLength,
    url: `${publicBase}/${image.key}`
  };
}

async function uploadImageToSee(image, config) {
  const form = new FormData();
  const file = new Blob([image.bytes], { type: image.contentType });
  form.append('file', file, image.filename);
  if (config.domain) form.append('domain', config.domain);

  const response = await fetch('https://s.ee/api/v1/file/upload', {
    method: 'POST',
    headers: {
      Authorization: seeAuthorization(config.token),
      accept: 'application/json'
    },
    body: form
  });
  const data = await response.json().catch(() => ({}));
  const url = seeImageUrl(data);

  if (!response.ok || !url) {
    throw httpError(data.message || data.error || data.code || 'SEE_UPLOAD_FAILED', response.status || 500);
  }

  return {
    key: image.key,
    filename: image.filename,
    contentType: image.contentType,
    size: image.bytes.byteLength,
    url,
    deleteUrl: data.data?.delete || data.data?.delete_url || ''
  };
}

function seeImageUrl(data) {
  if (!data || typeof data !== 'object') return '';
  const direct = data.url || data.link || data.image || data.images;
  if (isHttpUrl(direct)) return direct;

  const item = data.data || {};
  const nested = item.url || item.link || item.image || item.images || item.page || item.links?.url || item.links?.html;
  if (isHttpUrl(nested)) return nested;

  return '';
}

function seeAuthorization(token) {
  const value = String(token || '').trim();
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
}

function isHttpUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value || '').trim());
}

async function uploadImageToR2(image, config) {
  await config.bucket.put(image.key, image.bytes, {
    httpMetadata: {
      contentType: image.contentType,
      cacheControl: 'public, max-age=31536000, immutable'
    },
    customMetadata: {
      filename: image.filename
    }
  });

  return {
    key: image.key,
    filename: image.filename,
    contentType: image.contentType,
    size: image.bytes.byteLength,
    url: `${config.publicBaseUrl}/${image.key}`
  };
}

async function readImageFromR2(request, env) {
  if (!env.BLOG_IMAGES_BUCKET) {
    return json({ ok: false, error: 'IMAGE_STORAGE_NOT_CONFIGURED' }, request, env, 404);
  }

  const key = urlImageKey(new URL(request.url));
  if (!key) return json({ ok: false, error: 'IMAGE_NOT_FOUND' }, request, env, 404);

  const object = await env.BLOG_IMAGES_BUCKET.get(key);
  if (!object) return json({ ok: false, error: 'IMAGE_NOT_FOUND' }, request, env, 404);

  return new Response(object.body, {
    headers: {
      ...corsHeaders(request, env),
      'content-type': object.httpMetadata?.contentType || contentTypeFromKey(key),
      'cache-control': object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable',
      etag: object.httpEtag
    }
  });
}

function urlImageKey(url) {
  const prefix = '/blog-images/';
  if (!url.pathname.startsWith(prefix)) return '';
  try {
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    return normalizeObjectKey(key);
  } catch (error) {
    return '';
  }
}

function normalizeObjectKey(value) {
  const key = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = key.split('/').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return '';
  if (parts.some((part) => part === '.' || part === '..' || part.startsWith('..'))) return '';
  return parts.join('/');
}

function contentTypeFromKey(key) {
  const extension = String(key || '').split('.').pop().toLowerCase();
  const map = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif'
  };
  return map[extension] || 'application/octet-stream';
}

async function tencentCosAuthorization({ method, path, headers, secretId, secretKey }) {
  const now = Math.floor(Date.now() / 1000) - 30;
  const keyTime = `${now};${now + 600}`;
  const entries = Object.entries(headers)
    .map(([key, value]) => [cosEncode(key.toLowerCase()), cosEncode(String(value || '').trim())])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const headerList = entries.map(([key]) => key).join(';');
  const httpHeaders = entries.map(([key, value]) => `${key}=${value}`).join('&');
  const httpString = `${method.toLowerCase()}\n${path}\n\n${httpHeaders}\n`;
  const stringToSign = `sha1\n${keyTime}\n${await sha1Hex(httpString)}\n`;
  const signKey = await hmacSha1Hex(secretKey, keyTime);
  const signature = await hmacSha1Hex(signKey, stringToSign);

  return [
    'q-sign-algorithm=sha1',
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    'q-url-param-list=',
    `q-signature=${signature}`
  ].join('&');
}

function normalizeImageContentType(value) {
  const text = String(value || '').toLowerCase().split(';')[0].trim();
  if (text === 'image/jpg') return 'image/jpeg';
  return IMAGE_TYPES[text] ? text : '';
}

function imageObjectKey(filename, extension, prefix) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const name = sanitizeImageName(filename);
  return `${prefix}/${year}/${month}/${Date.now()}-${randomId()}-${name}.${extension}`;
}

function sanitizeImageName(value) {
  const base = String(value || 'image')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 44);
  return base || 'image';
}

function normalizeObjectPrefix(value) {
  const prefix = String(value || DEFAULT_IMAGE_PREFIX)
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('/');
  return prefix || DEFAULT_IMAGE_PREFIX;
}

function randomId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesFromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sha1Hex(value) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return hexFromBytes(new Uint8Array(digest));
}

async function hmacSha1Hex(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
  return hexFromBytes(new Uint8Array(signature));
}

function hexFromBytes(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cosEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function githubHeaders(env) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${String(env.GITHUB_TOKEN || '').trim()}`,
    'content-type': 'application/json',
    'user-agent': 'sly-blog-writer',
    'x-github-api-version': '2022-11-28'
  };
}

function githubRepoConfig(env) {
  return {
    owner: trimText(env.GITHUB_OWNER, 80) || DEFAULT_GITHUB_OWNER,
    repo: trimText(env.GITHUB_REPO, 80) || DEFAULT_GITHUB_REPO,
    branch: trimText(env.GITHUB_BRANCH, 80) || DEFAULT_GITHUB_BRANCH
  };
}

function githubContentsEndpoint(owner, repo, path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
}

function base64FromUtf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function utf8FromBase64(value) {
  const binary = atob(String(value || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function normalizePostPath(value) {
  const text = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!text) return '';
  const path = text.startsWith(`${POSTS_DIR}/`) ? text : `${POSTS_DIR}/${text}`;
  const parts = path.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'source' || parts[1] !== '_posts') return '';
  if (parts.some((part) => part === '.' || part === '..' || part.startsWith('..'))) return '';
  if (!/\.md$/i.test(parts[parts.length - 1])) return '';
  return parts.join('/');
}

function parsePostContent(content) {
  const text = String(content || '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: {}, markdown: text };
  return {
    meta: parseSimpleYaml(match[1]),
    markdown: text.slice(match[0].length)
  };
}

function parseSimpleYaml(value) {
  const meta = {};
  const lines = String(value || '').split(/\r?\n/);

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith('#')) {
      index += 1;
      continue;
    }

    const match = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!match) {
      index += 1;
      continue;
    }

    const key = match[1];
    const rawValue = match[2] || '';
    if (!rawValue.trim()) {
      const values = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const item = /^\s*-\s*(.*)$/.exec(lines[cursor]);
        if (!item) break;
        values.push(parseYamlScalar(item[1]));
        cursor += 1;
      }
      meta[key] = values.length ? values : '';
      index = values.length ? cursor : index + 1;
      continue;
    }

    meta[key] = parseYamlScalar(rawValue.trim());
    index += 1;
  }

  return meta;
}

function parseYamlScalar(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    if (text.startsWith('"')) {
      try {
        return JSON.parse(text);
      } catch (error) {
        return text.slice(1, -1);
      }
    }
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

function postMetaForClient(meta) {
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : (meta.tags ? [String(meta.tags)] : []);
  const categories = Array.isArray(meta.categories)
    ? meta.categories
    : (meta.categories ? [meta.categories] : (meta.category ? [meta.category] : []));

  return {
    ...meta,
    title: String(meta.title || ''),
    date: String(meta.date || ''),
    updated: String(meta.updated || ''),
    category: String(categories[0] || ''),
    tags,
    cover: String(meta.cover || ''),
    description: String(meta.description || '')
  };
}

function formatYamlEntry(key, value) {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return [];
  if (Array.isArray(value)) {
    return value.length
      ? [`${key}:`, ...value.map((item) => `  - ${yamlString(item)}`)]
      : [`${key}:`];
  }
  if (value === undefined || value === null || value === '') return [`${key}:`];
  return [`${key}: ${yamlString(value)}`];
}

function sanitizeFilename(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|#%{}^~[\]`;]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
  return cleaned || `post-${Date.now()}`;
}

function sanitizeDate(value) {
  const text = trimText(value, 30);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text : '';
}

function formatDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function yamlString(value) {
  return JSON.stringify(String(value || ''));
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function githubContributionsSvg(request, env, url) {
  const username = sanitizeGithubUser(url.searchParams.get('user') || 'sly3601');
  const color = sanitizeHexColor(url.searchParams.get('color') || 'ffc1da');

  try {
    const result = await readContributionCalendarFromGithubApi(username, env);
    if (result.days.length) {
      return svgResponse(renderContributionSvg({ username, color, days: result.days, total: result.total }), request, env, 600);
    }
  } catch (error) {
    // Fall through to the public HTML endpoint. It is less stable, but works without GraphQL.
  }

  try {
    const response = await fetchWithTimeout(`https://github.com/users/${username}/contributions`, {
      headers: {
        accept: 'text/html',
        'user-agent': 'sly-blog-contribution-widget'
      }
    }, 4500);
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

async function readContributionCalendarFromGithubApi(username, env) {
  const token = String(env.GITHUB_TOKEN || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');

  const query = `
    query ContributionCalendar($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
                weekday
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetchWithTimeout('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'sly-blog-contribution-widget'
    },
    body: JSON.stringify({ query, variables: { login: username } })
  }, 4500);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.errors) {
    throw new Error('GITHUB_GRAPHQL_FAILED');
  }

  const calendar = data.data?.user?.contributionsCollection?.contributionCalendar;
  const weeks = Array.isArray(calendar?.weeks) ? calendar.weeks : [];
  const days = [];
  weeks.forEach((week, col) => {
    const contributionDays = Array.isArray(week.contributionDays) ? week.contributionDays : [];
    contributionDays.forEach((day) => {
      if (!day || !day.date) return;
      days.push({
        date: String(day.date),
        count: Number(day.contributionCount || 0),
        level: contributionLevelNumber(day.contributionLevel),
        row: clampNumber(day.weekday, 0, 6, new Date(`${day.date}T00:00:00Z`).getUTCDay()),
        col
      });
    });
  });

  return {
    days,
    total: String(calendar?.totalContributions || '')
  };
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
    const title = Number.isFinite(day.count) ? `${day.date}: ${day.count} contributions` : `${day.date}: level ${day.level}`;
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${escapeXml(title)}</title></rect>`;
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
  return ['#f4e7ee', '#ffd2e4', base, '#f574ad', '#c93f80'];
}

function contributionLevelNumber(level) {
  const map = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4
  };
  return map[String(level || '').toUpperCase()] ?? 0;
}

function renderContributionFallback(username) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="124" viewBox="0 0 700 124" role="img" aria-label="GitHub contribution calendar unavailable">
  <rect width="100%" height="100%" rx="10" fill="#fffafb"/>
  <text x="24" y="56" fill="#8f5570" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="14" font-weight="700">暂时没有读到 @${escapeXml(username)} 的 GitHub 贡献图</text>
  <text x="24" y="80" fill="#9b7284" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12">刷新后会自动重试。</text>
</svg>`;
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('TIMEOUT'), timeoutMs);
  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
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
  const allowedOrigins = `${DEFAULT_ALLOWED_ORIGINS.join(',')},${env.ALLOWED_ORIGINS || ''}`
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const allowOrigin = origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))
    ? origin
    : allowedOrigins[0] || '*';

  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, x-admin-token',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}
