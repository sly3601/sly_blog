(function () {
  const DRAFT_KEY = 'sly_blog_post_editor_draft_v1';
  const TOKEN_KEY = 'sly_blog_post_editor_admin_token';
  const ENDPOINT_KEY = 'sly_blog_post_editor_endpoint';
  const IMAGE_MAX_SIDE = 1800;
  const IMAGE_WEBP_QUALITY = 0.82;
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
    postSelect: document.getElementById('writePostSelect'),
    refreshPosts: document.getElementById('writeRefreshPosts'),
    loadPost: document.getElementById('writeLoadPost'),
    deletePost: document.getElementById('writeDeletePost'),
    newPost: document.getElementById('writeNewPost'),
    postMeta: document.getElementById('writePostMeta'),
    endpoint: document.getElementById('writeEndpoint'),
    token: document.getElementById('writeAdminToken'),
    overwrite: document.getElementById('writeOverwrite'),
    localSave: document.getElementById('writeLocalSave'),
    export: document.getElementById('writeExport'),
    publish: document.getElementById('writePublish'),
    imageUpload: document.getElementById('writeImageUpload'),
    imageInput: document.getElementById('writeImageInput'),
    clearSecret: document.getElementById('writeClearSecret'),
    editorHost: document.getElementById('writeEditor'),
    status: document.getElementById('writeStatus'),
    toast: document.getElementById('writeToast')
  };

  let editor;
  let fallbackTextarea;
  let currentPost = null;
  let postList = [];
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
    if (getAdminToken()) loadPostList(false);
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
    els.imageUpload.addEventListener('click', () => els.imageInput.click());
    els.imageInput.addEventListener('change', () => {
      uploadImages(els.imageInput.files, '选择的图片');
      els.imageInput.value = '';
    });
    els.refreshPosts.addEventListener('click', () => loadPostList(true));
    els.loadPost.addEventListener('click', loadSelectedPost);
    els.deletePost.addEventListener('click', deleteSelectedPost);
    els.newPost.addEventListener('click', startNewPost);
    els.postSelect.addEventListener('change', updateDeleteState);
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

    document.addEventListener('paste', handleImagePaste);
    els.editorHost.addEventListener('dragover', handleImageDragOver);
    els.editorHost.addEventListener('dragleave', handleImageDragLeave);
    els.editorHost.addEventListener('drop', handleImageDrop);
  }

  async function loadPostList(showMessage) {
    if (!getEndpoint()) {
      showToast('Cloudflare 接口地址为空');
      return;
    }
    if (!getAdminToken()) {
      showToast('先填写管理员密钥，再刷新文章列表');
      return;
    }

    rememberConfig();
    setStatus('正在读取 GitHub 文章列表...');
    setLoading([els.refreshPosts, els.loadPost, els.deletePost], true);

    try {
      const data = await apiRequest('/blog-posts?action=list', { method: 'GET' });
      postList = Array.isArray(data.posts) ? data.posts : [];
      renderPostOptions();
      setStatus(`已读取 ${postList.length} 篇文章`);
      if (showMessage) showToast(`已读取 ${postList.length} 篇文章`);
    } catch (error) {
      setStatus('文章列表读取失败');
      showToast(error.message || '文章列表读取失败');
    } finally {
      setLoading([els.refreshPosts, els.loadPost, els.deletePost], false);
      updateDeleteState();
    }
  }

  async function loadSelectedPost() {
    const path = els.postSelect.value;
    if (!path) {
      showToast('先选择一篇文章');
      return;
    }

    rememberConfig();
    setStatus('正在载入文章...');
    setLoading([els.loadPost, els.refreshPosts, els.deletePost], true);

    try {
      const data = await apiRequest(`/blog-posts?action=read&path=${encodeURIComponent(path)}`, { method: 'GET' });
      applyLoadedPost(data);
      saveDraft();
      showToast(`已载入：${data.filename || path}`);
    } catch (error) {
      setStatus('文章载入失败');
      showToast(error.message || '文章载入失败');
    } finally {
      setLoading([els.loadPost, els.refreshPosts, els.deletePost], false);
      updateDeleteState();
    }
  }

  async function deleteSelectedPost() {
    const target = getSelectedPost();
    if (!target) {
      showToast('先选择一篇文章');
      return;
    }
    if (!getEndpoint()) {
      showToast('Cloudflare 接口地址为空');
      return;
    }
    if (!getAdminToken()) {
      showToast('需要管理员密钥才能删除 GitHub 文章');
      return;
    }

    const targetName = target.title || target.filename || target.path;
    const confirmed = window.confirm(`确定要删除「${targetName}」吗？\n\n这会从 GitHub 仓库删除 Markdown 源文件，并触发一次重新部署。`);
    if (!confirmed) return;

    rememberConfig();
    setStatus('正在删除文章...');
    setLoading([els.deletePost, els.loadPost, els.refreshPosts, els.publish], true);

    try {
      const data = await apiRequest(`/blog-posts?path=${encodeURIComponent(target.path)}`, { method: 'DELETE' });
      postList = postList.filter((post) => post.path !== target.path);
      if (currentPost && currentPost.path === target.path) {
        startNewPost();
      }
      renderPostOptions();
      setStatus(`已删除：${data.path || target.path}`);
      showToast(`已删除：${targetName}`);
    } catch (error) {
      setStatus('删除失败');
      showToast(error.message || '删除失败，请稍后重试');
    } finally {
      setLoading([els.deletePost, els.loadPost, els.refreshPosts, els.publish], false);
      updateDeleteState();
    }
  }

  function applyLoadedPost(data) {
    const meta = data.meta || {};
    const filename = data.filename || (data.path || '').split('/').pop() || '';
    els.title.value = meta.title || filename.replace(/\.md$/i, '');
    els.slug.value = filename.replace(/\.md$/i, '');
    els.category.value = meta.category || '日记';
    els.tags.value = Array.isArray(meta.tags) ? meta.tags.join(', ') : '';
    els.cover.value = meta.cover || '';
    els.description.value = meta.description || '';
    els.overwrite.checked = true;
    slugTouched = true;
    setMarkdown(data.markdown || '');
    setCurrentPost({
      path: data.path || '',
      filename,
      date: meta.date || '',
      htmlUrl: data.htmlUrl || ''
    });
    setStatus(`正在编辑：${filename}`);
  }

  function startNewPost() {
    setCurrentPost(null);
    slugTouched = false;
    els.title.value = '';
    els.slug.value = '';
    els.category.value = '日记';
    els.tags.value = '';
    els.cover.value = '';
    els.description.value = '';
    els.overwrite.checked = false;
    setMarkdown(DEFAULT_MARKDOWN);
    saveDraft('已切换到新文章模式');
  }

  function renderPostOptions() {
    const selectedPath = currentPost && currentPost.path;
    els.postSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = postList.length ? '选择一篇文章载入编辑' : '没有读取到文章';
    els.postSelect.appendChild(placeholder);

    postList.forEach((post) => {
      const option = document.createElement('option');
      option.value = post.path;
      option.textContent = `${post.title || post.filename}${post.date ? ` · ${post.date.slice(0, 10)}` : ''}`;
      els.postSelect.appendChild(option);
    });

    if (selectedPath && postList.some((post) => post.path === selectedPath)) {
      els.postSelect.value = selectedPath;
    }
    updateDeleteState();
  }

  function setCurrentPost(post) {
    currentPost = post || null;
    const publishText = els.publish.querySelector('span');
    if (publishText) publishText.textContent = currentPost ? '保存修改到 GitHub' : '发布到 GitHub';
    if (els.postMeta) {
      els.postMeta.textContent = currentPost
        ? `正在编辑：${currentPost.filename || currentPost.path}${currentPost.date ? ` · 原日期 ${currentPost.date}` : ''}`
        : '未载入文章';
    }
    if (currentPost && currentPost.path) {
      els.postSelect.value = currentPost.path;
    } else if (els.postSelect) {
      els.postSelect.value = '';
    }
    updateDeleteState();
  }

  function getSelectedPost() {
    const path = els.postSelect.value || (currentPost && currentPost.path) || '';
    if (!path) return null;
    const fromList = postList.find((post) => post.path === path);
    if (fromList) return fromList;
    if (currentPost && currentPost.path === path) return currentPost;
    return {
      path,
      filename: path.split('/').pop()
    };
  }

  function updateDeleteState() {
    if (!els.deletePost) return;
    els.deletePost.disabled = !getSelectedPost();
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

    insertMarkdown(`\n${text}\n`);
  }

  function insertMarkdown(text) {
    if (editor && typeof editor.insertText === 'function') {
      editor.insertText(text);
    } else if (editor && typeof editor.setMarkdown === 'function') {
      editor.setMarkdown(`${editor.getMarkdown()}\n\n${text}\n`);
    } else if (fallbackTextarea) {
      insertIntoTextarea(fallbackTextarea, text);
    }
    scheduleDraftSave();
  }

  function handleImagePaste(event) {
    if (!isEditingMarkdown()) return;
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    uploadImages(files, '粘贴的截图');
  }

  function handleImageDragOver(event) {
    const hasImage = Array.from(event.dataTransfer?.items || []).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (!hasImage) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    els.editorHost.closest('.write-editor-shell')?.classList.add('is-dragging');
  }

  function handleImageDragLeave() {
    els.editorHost.closest('.write-editor-shell')?.classList.remove('is-dragging');
  }

  function handleImageDrop(event) {
    const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    els.editorHost.closest('.write-editor-shell')?.classList.remove('is-dragging');
    uploadImages(files, '拖入的图片');
  }

  function isEditingMarkdown() {
    const active = document.activeElement;
    if (!active) return true;
    if (fallbackTextarea && active === fallbackTextarea) return true;
    if (els.editorHost.contains(active)) return true;
    return !active.closest('input, textarea, select');
  }

  async function uploadImages(fileList, sourceLabel) {
    const files = Array.from(fileList || []).filter((file) => file && file.type.startsWith('image/'));
    if (!files.length) return;
    if (!getEndpoint()) {
      showToast('Cloudflare 接口地址为空');
      return;
    }
    if (!getAdminToken()) {
      showToast('需要管理员密钥才能上传图片');
      return;
    }

    rememberConfig();
    setLoading([els.imageUpload], true);
    setStatus(`正在上传 ${files.length} 张图片...`);

    try {
      for (const file of files) {
        const data = await uploadOneImage(file);
        const alt = file.name ? file.name.replace(/\.[^.]+$/, '') : '图片';
        insertMarkdown(`\n![${escapeMarkdownAlt(alt)}](${data.url})\n`);
      }
      setStatus(`${sourceLabel}已上传`);
      showToast(`${sourceLabel}已插入到光标位置`);
    } catch (error) {
      setStatus('图片上传失败');
      showToast(error.message || '图片上传失败');
    } finally {
      setLoading([els.imageUpload], false);
    }
  }

  async function uploadOneImage(file) {
    const image = await prepareImageForUpload(file);
    const content = await fileToBase64(image);
    return apiRequest('/blog-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: image.name || file.name || '',
        contentType: image.type,
        size: image.size,
        content
      })
    });
  }

  async function prepareImageForUpload(file) {
    if (!file || file.type === 'image/gif' || !file.type.startsWith('image/')) return file;
    if (!supportsCanvasCompression()) return file;

    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      context.drawImage(bitmap, 0, 0, width, height);
      if (typeof bitmap.close === 'function') bitmap.close();

      const blob = await canvasToBlob(canvas, 'image/webp', IMAGE_WEBP_QUALITY);
      if (!blob || blob.size >= file.size) return file;
      const filename = `${(file.name || 'image').replace(/\.[^.]+$/, '')}.webp`;
      return new File([blob], filename, { type: 'image/webp', lastModified: Date.now() });
    } catch (error) {
      return file;
    }
  }

  function supportsCanvasCompression() {
    return Boolean(window.createImageBitmap && window.File && HTMLCanvasElement.prototype.toBlob);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',').pop() : result);
      };
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function escapeMarkdownAlt(value) {
    return String(value || '图片').replace(/[\[\]\\]/g, '').slice(0, 80) || '图片';
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
      overwrite: els.overwrite.checked || Boolean(currentPost && currentPost.path),
      sourcePath: currentPost && currentPost.path ? currentPost.path : '',
      date: currentPost && currentPost.date ? currentPost.date : formatLocalDate(new Date())
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
      const response = await fetch(`${getApiBase()}/blog-posts`, {
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

      if (data.path) {
        setCurrentPost({
          path: data.path,
          filename: data.path.split('/').pop(),
          date: payload.date,
          htmlUrl: data.htmlUrl || ''
        });
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
      currentPost,
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
      setCurrentPost(draft.currentPost || null);
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

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${getAdminToken()}`,
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(humanizeError(data.error || `HTTP ${response.status}`));
    }
    return data;
  }

  function setLoading(buttons, loading) {
    buttons.forEach((button) => {
      if (button) button.disabled = loading;
    });
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

  function getApiBase() {
    return getEndpoint().replace(/\/+$/, '');
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
      POST_PATH_REQUIRED: '没有指定要读取的文章',
      POST_NOT_FOUND: 'GitHub 里没有找到这篇文章',
      FILE_EXISTS: '同名文章已存在，勾选“允许覆盖同名文章”后再试',
      GITHUB_READ_FAILED: 'GitHub 读取失败',
      GITHUB_WRITE_FAILED: 'GitHub 写入失败',
      GITHUB_DELETE_FAILED: 'GitHub 删除失败',
      GITHUB_IMAGE_REPO_NOT_FOUND: 'GitHub 图片仓库不存在',
      GITHUB_IMAGE_REPO_CREATE_FAILED: 'GitHub 图片仓库自动创建失败，请检查 GITHUB_TOKEN 权限',
      GITHUB_IMAGE_READ_FAILED: 'GitHub 图片仓库读取失败',
      GITHUB_IMAGE_UPLOAD_FAILED: 'GitHub 图片上传失败',
      IMAGE_TOO_LARGE: '图片太大，单张请控制在 10MB 以内',
      IMAGE_TYPE_NOT_ALLOWED: '只支持 PNG、JPG、WebP、GIF 图片',
      IMAGE_BODY_REQUIRED: '没有读到图片内容',
      IMAGE_STORAGE_NOT_CONFIGURED: '图片存储还没配置好',
      IMAGE_NOT_FOUND: '图片不存在',
      IMAGE_UPLOAD_FAILED: '图片上传失败',
      SEE_UPLOAD_FAILED: 'S.EE 图床上传失败',
      COS_NOT_CONFIGURED: '腾讯云 COS 还没配置好',
      COS_UPLOAD_FAILED: '腾讯云 COS 上传失败',
      REQUEST_TOO_LARGE: '图片或文章内容太大',
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
