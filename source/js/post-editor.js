(function () {
  const DRAFT_KEY = 'sly_blog_post_editor_draft_v1';
  const TOKEN_KEY = 'sly_blog_post_editor_admin_token';
  const ENDPOINT_KEY = 'sly_blog_post_editor_endpoint';
  const DEFAULT_MARKDOWN = [
    '## 开头',
    '',
    '在这里写正文。你可以用左上方按钮插入高亮、代码块、待办和提示块。',
    '',
    '<mark>这是一段高亮文字</mark>',
    '',
    '```python',
    'print("hello, blog")',
    '```'
  ].join('\n');

  const app = document.getElementById('post-editor-app');
  if (!app) return;
  document.body.classList.add('post-editor-page');

  const els = {
    title: document.getElementById('writeTitle'),
    slug: document.getElementById('writeSlug'),
    category: document.getElementById('writeCategory'),
    tags: document.getElementById('writeTags'),
    cover: document.getElementById('writeCover'),
    description: document.getElementById('writeDescription'),
    endpoint: document.getElementById('writeEndpoint'),
    token: document.getElementById('writeAdminToken'),
    overwrite: document.getElementById('writeOverwrite'),
    localSave: document.getElementById('writeLocalSave'),
    export: document.getElementById('writeExport'),
    publish: document.getElementById('writePublish'),
    clearSecret: document.getElementById('writeClearSecret'),
    editorHost: document.getElementById('writeEditor'),
    status: document.getElementById('writeStatus'),
    toast: document.getElementById('writeToast')
  };

  let editor;
  let fallbackTextarea;
  let slugTouched = false;
  let saveTimer;
  let toastTimer;

  function init() {
    els.endpoint.value = localStorage.getItem(ENDPOINT_KEY) || app.dataset.apiEndpoint || '';
    els.token.value = localStorage.getItem(TOKEN_KEY) || '';
    restoreDraft();
    createEditor();
    bindEvents();
    setStatus('草稿已就绪');
  }

  function createEditor() {
    const initialValue = getDraftMarkdown() || DEFAULT_MARKDOWN;
    if (window.toastui && window.toastui.Editor) {
      editor = new window.toastui.Editor({
        el: els.editorHost,
        height: '720px',
        initialEditType: 'markdown',
        previewStyle: 'vertical',
        usageStatistics: false,
        initialValue,
        toolbarItems: [
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task'],
          ['table', 'link'],
          ['code', 'codeblock']
        ]
      });
      editor.on('change', scheduleDraftSave);
      return;
    }

    fallbackTextarea = document.createElement('textarea');
    fallbackTextarea.className = 'write-fallback-textarea';
    fallbackTextarea.value = initialValue;
    fallbackTextarea.addEventListener('input', scheduleDraftSave);
    els.editorHost.innerHTML = '';
    els.editorHost.appendChild(fallbackTextarea);
    showToast('编辑器 CDN 暂时不可用，已切换到基础 Markdown 输入框');
  }

  function bindEvents() {
    [els.title, els.slug, els.category, els.tags, els.cover, els.description, els.endpoint, els.token, els.overwrite].forEach((input) => {
      input.addEventListener('input', () => {
        if (input === els.slug) slugTouched = true;
        if (input === els.title && !slugTouched) {
          els.slug.value = toFileSlug(els.title.value);
        }
        scheduleDraftSave();
      });
      input.addEventListener('change', scheduleDraftSave);
    });

    document.querySelectorAll('[data-insert]').forEach((button) => {
      button.addEventListener('click', () => insertSnippet(button.dataset.insert));
    });

    els.localSave.addEventListener('click', () => saveDraft('草稿已保存到当前浏览器'));
    els.export.addEventListener('click', exportMarkdown);
    els.publish.addEventListener('click', publishPost);
    els.clearSecret.addEventListener('click', () => {
      els.token.value = '';
      localStorage.removeItem(TOKEN_KEY);
      showToast('已清除当前浏览器里的管理员密钥');
    });

    window.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDraft('草稿已保存');
      }
    });
  }

  function insertSnippet(kind) {
    const snippets = {
      highlight: '<mark>高亮内容</mark>',
      code: '```js\nconsole.log("hello, blog");\n```',
      todo: '- [ ] 待办事项\n- [x] 已完成事项',
      callout: '> [!NOTE]\n> 这里写一个醒目的提示。'
    };
    const text = snippets[kind] || '';
    if (!text) return;

    if (editor && typeof editor.insertText === 'function') {
      editor.insertText(`\n${text}\n`);
    } else if (editor && typeof editor.setMarkdown === 'function') {
      editor.setMarkdown(`${editor.getMarkdown()}\n\n${text}\n`);
    } else if (fallbackTextarea) {
      insertIntoTextarea(fallbackTextarea, `\n${text}\n`);
    }
    scheduleDraftSave();
  }

  function insertIntoTextarea(textarea, text) {
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
  }

  function getMarkdown() {
    if (editor && typeof editor.getMarkdown === 'function') return editor.getMarkdown();
    return fallbackTextarea ? fallbackTextarea.value : '';
  }

  function setMarkdown(value) {
    if (editor && typeof editor.setMarkdown === 'function') {
      editor.setMarkdown(value || '');
    } else if (fallbackTextarea) {
      fallbackTextarea.value = value || '';
    }
  }

  function collectPayload() {
    return {
      title: els.title.value.trim(),
      slug: els.slug.value.trim(),
      category: els.category.value.trim(),
      tags: splitTags(els.tags.value),
      cover: els.cover.value.trim(),
      description: els.description.value.trim(),
      markdown: getMarkdown(),
      overwrite: els.overwrite.checked,
      date: formatLocalDate(new Date())
    };
  }

  function validatePayload(payload) {
    if (!payload.title) return '先写文章标题';
    if (!payload.markdown.trim()) return '正文不能为空';
    if (!getEndpoint()) return 'Cloudflare 接口地址为空';
    if (!getAdminToken()) return '需要管理员密钥才能发布到 GitHub';
    return '';
  }

  async function publishPost() {
    const payload = collectPayload();
    const error = validatePayload(payload);
    if (error) {
      showToast(error);
      return;
    }

    rememberConfig();
    setStatus('正在发布到 GitHub...');
    els.publish.disabled = true;

    try {
      const response = await fetch(`${getEndpoint().replace(/\/+$/, '')}/blog-posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(humanizeError(data.error || `HTTP ${response.status}`));
      }

      saveDraft();
      setStatus(`已发布：${data.path}`);
      showToast(`已保存到 GitHub：${data.path}`);
      if (data.htmlUrl) window.open(data.htmlUrl, '_blank', 'noopener');
    } catch (publishError) {
      setStatus('发布失败');
      showToast(publishError.message || '发布失败，请稍后重试');
    } finally {
      els.publish.disabled = false;
    }
  }

  function saveDraft(message) {
    rememberConfig();
    const draft = {
      ...collectPayload(),
      slugTouched,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setStatus('草稿已保存');
    if (message) showToast(message);
  }

  function scheduleDraftSave() {
    clearTimeout(saveTimer);
    setStatus('正在保存草稿...');
    saveTimer = setTimeout(() => saveDraft(), 450);
  }

  function restoreDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      els.title.value = '';
      els.slug.value = '';
      return;
    }

    try {
      const draft = JSON.parse(raw);
      els.title.value = draft.title || '';
      els.slug.value = draft.slug || '';
      els.category.value = draft.category || '日记';
      els.tags.value = Array.isArray(draft.tags) ? draft.tags.join(', ') : (draft.tags || '');
      els.cover.value = draft.cover || '';
      els.description.value = draft.description || '';
      els.overwrite.checked = Boolean(draft.overwrite);
      slugTouched = Boolean(draft.slugTouched || draft.slug);
      app.dataset.draftMarkdown = draft.markdown || '';
    } catch (error) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }

  function getDraftMarkdown() {
    return app.dataset.draftMarkdown || '';
  }

  function rememberConfig() {
    localStorage.setItem(ENDPOINT_KEY, els.endpoint.value.trim());
    if (els.token.value.trim()) localStorage.setItem(TOKEN_KEY, els.token.value.trim());
  }

  function exportMarkdown() {
    const payload = collectPayload();
    const file = new Blob([buildLocalPreviewMarkdown(payload)], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `${payload.slug || toFileSlug(payload.title) || 'post'}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Markdown 已导出');
  }

  function buildLocalPreviewMarkdown(payload) {
    const tags = payload.tags.map((tag) => `  - ${JSON.stringify(tag)}`).join('\n');
    return [
      '---',
      `title: ${JSON.stringify(payload.title || '未命名文章')}`,
      `date: ${JSON.stringify(payload.date)}`,
      payload.category ? 'categories:\n  - ' + JSON.stringify(payload.category) : '',
      tags ? `tags:\n${tags}` : '',
      payload.cover ? `cover: ${JSON.stringify(payload.cover)}` : '',
      payload.description ? `description: ${JSON.stringify(payload.description)}` : '',
      '---',
      '',
      payload.markdown.trim(),
      ''
    ].filter((line) => line !== '').join('\n');
  }

  function splitTags(value) {
    return value
      .split(/[,，、]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  function toFileSlug(value) {
    return String(value || '')
      .trim()
      .replace(/[\\/:*?"<>|#%{}^~[\]`;]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
  }

  function formatLocalDate(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function getEndpoint() {
    return els.endpoint.value.trim();
  }

  function getAdminToken() {
    return els.token.value.trim();
  }

  function humanizeError(error) {
    const map = {
      GITHUB_TOKEN_NOT_CONFIGURED: 'Cloudflare 还没有配置 GITHUB_TOKEN，暂时不能写入 GitHub',
      UNAUTHORIZED: '管理员密钥不对',
      TITLE_REQUIRED: '文章标题不能为空',
      BODY_REQUIRED: '正文不能为空',
      FILE_EXISTS: '同名文章已存在，勾选“允许覆盖同名文章”后再试',
      GITHUB_WRITE_FAILED: 'GitHub 写入失败',
      INVALID_JSON: '请求格式不正确'
    };
    return map[error] || error;
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2800);
  }

  init();
})();
