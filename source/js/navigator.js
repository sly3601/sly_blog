(function () {
  const COMMON_TOKEN_KEY = 'sly_blog_common_admin_token';
  const TOKEN_FALLBACK_KEYS = [
    COMMON_TOKEN_KEY,
    'sly_blog_post_editor_admin_token',
    'sly_blog_skill_tree_cloud_token'
  ];
  const ENDPOINT_KEY = 'sly_blog_navigator_endpoint';
  const ENDPOINT_FALLBACK_KEYS = [
    ENDPOINT_KEY,
    'sly_blog_skill_tree_cloud_endpoint',
    'sly_blog_post_editor_endpoint'
  ];
  const CACHE_KEY = 'sly_blog_navigator_cache_v1';
  const ALL_GROUP = '__all__';
  const PINNED_GROUP = '__pinned__';

  const app = document.getElementById('navigator-app');
  if (!app) return;

  document.body.classList.add('navigator-page');

  const els = {
    lock: document.getElementById('navLock'),
    desk: document.getElementById('navDesk'),
    unlockForm: document.getElementById('navUnlockForm'),
    unlockButton: document.getElementById('navUnlockButton'),
    lockButton: document.getElementById('navLockButton'),
    endpoint: document.getElementById('navEndpoint'),
    token: document.getElementById('navAdminToken'),
    lockStatus: document.getElementById('navLockStatus'),
    siteCount: document.getElementById('navSiteCount'),
    syncStatus: document.getElementById('navSyncStatus'),
    searchForm: document.getElementById('navSearchForm'),
    searchInput: document.getElementById('navSearchInput'),
    searchClear: document.getElementById('navSearchClear'),
    groupTabs: document.getElementById('navGroupTabs'),
    grid: document.getElementById('navSitesGrid'),
    fabAdd: document.getElementById('navFabAdd'),
    dialog: document.getElementById('navSiteDialog'),
    form: document.getElementById('navSiteForm'),
    dialogTitle: document.getElementById('navDialogTitle'),
    editingId: document.getElementById('navEditingId'),
    siteTitle: document.getElementById('navSiteTitle'),
    siteUrl: document.getElementById('navSiteUrl'),
    iconType: document.getElementById('navIconType'),
    siteIcon: document.getElementById('navSiteIcon'),
    siteColor: document.getElementById('navSiteColor'),
    iconValueField: document.getElementById('navIconValueField'),
    iconPreview: document.getElementById('navIconPreview'),
    siteGroup: document.getElementById('navSiteGroup'),
    sitePinned: document.getElementById('navSitePinned'),
    siteNote: document.getElementById('navSiteNote'),
    deleteInDialog: document.getElementById('navDeleteInDialog'),
    toast: document.getElementById('navToast')
  };

  let sites = [];
  let activeGroup = ALL_GROUP;
  let toastTimer;
  let lastFocusedElement = null;

  function init() {
    els.endpoint.value = storedValue(ENDPOINT_FALLBACK_KEYS) || app.dataset.apiEndpoint || '';
    els.token.value = storedValue(TOKEN_FALLBACK_KEYS);
    bindEvents();
    render();

    if (els.endpoint.value.trim() && els.token.value.trim()) {
      unlock({ silent: true });
    }
  }

  function bindEvents() {
    els.unlockForm.addEventListener('submit', (event) => {
      event.preventDefault();
      unlock();
    });

    els.lockButton.addEventListener('click', lock);
    els.fabAdd.addEventListener('click', () => openDialog());
    els.searchInput.addEventListener('input', render);
    els.searchClear.addEventListener('click', () => {
      els.searchInput.value = '';
      render();
      els.searchInput.focus();
    });

    els.searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      openSearchTarget();
    });

    els.form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveDialogSite();
    });

    els.deleteInDialog.addEventListener('click', () => {
      const id = els.editingId.value;
      if (id) deleteSite(id, { fromDialog: true });
    });

    document.querySelectorAll('[data-close-dialog]').forEach((item) => {
      item.addEventListener('click', closeDialog);
    });

    [els.siteTitle, els.siteUrl, els.iconType, els.siteIcon, els.siteColor].forEach((input) => {
      input.addEventListener('input', updateIconPreview);
      input.addEventListener('change', updateIconPreview);
    });

    els.iconType.addEventListener('change', syncIconTypeUi);
    els.siteUrl.addEventListener('blur', autofillFromUrl);

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !els.dialog.hidden) closeDialog();
    });
  }

  async function unlock(options = {}) {
    if (!getEndpoint()) {
      setLockStatus('先填写 Cloudflare 接口');
      return;
    }

    if (!getToken()) {
      setLockStatus('先输入管理员密钥');
      return;
    }

    setLockStatus('正在解锁...');
    els.unlockButton.disabled = true;

    try {
      rememberAccess();
      const data = await apiRequest({ method: 'GET' });
      sites = normalizeSites(data.sites || []);
      app.classList.add('is-unlocked');
      cacheSites();
      setSyncStatus(data.updatedAt ? `已同步 ${formatTime(data.updatedAt)}` : '已同步');
      render();
      setTimeout(() => els.searchInput.focus(), 80);
      if (!options.silent) showToast('私人导航已解锁');
    } catch (error) {
      app.classList.remove('is-unlocked');
      sites = [];
      setLockStatus(error.message || '解锁失败');
      if (!options.silent) showToast(error.message || '解锁失败');
    } finally {
      els.unlockButton.disabled = false;
    }
  }

  function lock() {
    app.classList.remove('is-unlocked');
    sites = [];
    els.token.value = '';
    localStorage.removeItem(COMMON_TOKEN_KEY);
    setLockStatus('已锁定');
    render();
  }

  function render() {
    renderGroups();
    renderSites();
    els.siteCount.textContent = `${sites.length} 个收藏`;
  }

  function renderGroups() {
    const groups = uniqueGroups();
    if (activeGroup !== ALL_GROUP && activeGroup !== PINNED_GROUP && !groups.includes(activeGroup)) {
      activeGroup = ALL_GROUP;
    }

    els.groupTabs.innerHTML = '';
    addGroupTab(ALL_GROUP, '全部');
    if (sites.some((site) => site.pinned)) addGroupTab(PINNED_GROUP, '置顶');
    groups.forEach((group) => addGroupTab(group, group));
  }

  function addGroupTab(value, label) {
    const button = document.createElement('button');
    button.className = `nav-group-tab${activeGroup === value ? ' is-active' : ''}`;
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      activeGroup = value;
      render();
    });
    els.groupTabs.appendChild(button);
  }

  function renderSites() {
    els.grid.innerHTML = '';
    const visibleSites = filteredSites();

    if (!sites.length) {
      els.grid.appendChild(emptyCard('还没有收藏网站'));
    } else if (!visibleSites.length) {
      els.grid.appendChild(emptyCard('没有匹配的网站'));
    } else {
      visibleSites.forEach((site) => els.grid.appendChild(siteCard(site)));
    }

    els.grid.appendChild(addCard());
  }

  function siteCard(site) {
    const card = document.createElement('article');
    card.className = 'nav-site-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', site.title);

    const actions = document.createElement('div');
    actions.className = 'nav-card-actions';
    actions.appendChild(iconButton('fas fa-pen', '编辑', (event) => {
      event.stopPropagation();
      openDialog(site);
    }));
    actions.appendChild(iconButton('fas fa-trash-alt', '删除', (event) => {
      event.stopPropagation();
      deleteSite(site.id);
    }));

    const icon = document.createElement('div');
    icon.className = 'nav-site-icon';
    renderIcon(icon, site);

    const title = document.createElement('p');
    title.className = 'nav-site-title';
    title.textContent = site.title;

    card.append(actions, icon, title);

    if (site.note) {
      const note = document.createElement('p');
      note.className = 'nav-site-note';
      note.textContent = site.note;
      card.appendChild(note);
    }

    card.addEventListener('click', () => openSite(site));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openSite(site);
      }
    });

    return card;
  }

  function addCard() {
    const card = document.createElement('button');
    card.className = 'nav-add-card';
    card.type = 'button';
    card.addEventListener('click', () => openDialog());

    const icon = document.createElement('div');
    icon.className = 'nav-site-icon';
    icon.innerHTML = '<i class="fas fa-plus"></i>';

    const title = document.createElement('p');
    title.className = 'nav-site-title';
    title.textContent = '添加网站';

    card.append(icon, title);
    return card;
  }

  function emptyCard(message) {
    const card = document.createElement('div');
    card.className = 'nav-empty-card';
    const text = document.createElement('p');
    text.textContent = message;
    card.appendChild(text);
    return card;
  }

  function iconButton(iconClass, title, onClick) {
    const button = document.createElement('button');
    button.className = 'nav-icon-button';
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = `<i class="${iconClass}"></i>`;
    button.addEventListener('click', onClick);
    return button;
  }

  function openDialog(site) {
    lastFocusedElement = document.activeElement;
    const isEditing = Boolean(site);
    els.dialogTitle.textContent = isEditing ? '编辑网站' : '添加网站';
    els.editingId.value = site ? site.id : '';
    els.siteTitle.value = site ? site.title : '';
    els.siteUrl.value = site ? site.url : '';
    els.iconType.value = site ? site.iconType : 'favicon';
    els.siteIcon.value = site ? site.icon : '';
    els.siteColor.value = site ? site.color : nextColor();
    els.siteGroup.value = site ? site.group : '';
    els.sitePinned.checked = site ? site.pinned : false;
    els.siteNote.value = site ? site.note : '';
    els.deleteInDialog.hidden = !isEditing;
    syncIconTypeUi();
    updateIconPreview();
    els.dialog.hidden = false;
    setTimeout(() => (isEditing ? els.siteTitle : els.siteUrl).focus(), 30);
  }

  function closeDialog() {
    els.dialog.hidden = true;
    els.form.reset();
    els.editingId.value = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  async function saveDialogSite() {
    const site = collectDialogSite();
    if (!site) return;

    const index = sites.findIndex((item) => item.id === site.id);
    if (index >= 0) sites.splice(index, 1, site);
    else sites.push(site);

    closeDialog();
    render();
    await saveRemote('网站已保存');
  }

  function collectDialogSite() {
    const url = normalizeUrl(els.siteUrl.value);
    if (!url) {
      showToast('网址格式不对');
      els.siteUrl.focus();
      return null;
    }

    const id = els.editingId.value || createId();
    const title = els.siteTitle.value.trim() || hostname(url) || '未命名网站';
    const iconType = els.iconType.value;
    return normalizeSite({
      id,
      title,
      url,
      iconType,
      icon: els.siteIcon.value.trim(),
      color: els.siteColor.value,
      group: els.siteGroup.value.trim(),
      note: els.siteNote.value.trim(),
      pinned: els.sitePinned.checked,
      createdAt: currentSite(id)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, sites.length);
  }

  async function deleteSite(id, options = {}) {
    const site = currentSite(id);
    if (!site) return;

    if (!window.confirm(`删除「${site.title}」？`)) return;
    sites = sites.filter((item) => item.id !== id);
    if (options.fromDialog) closeDialog();
    render();
    await saveRemote('网站已删除');
  }

  async function saveRemote(message) {
    setSyncStatus('保存中...');
    try {
      const data = await apiRequest({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites })
      });
      sites = normalizeSites(data.sites || sites);
      cacheSites();
      setSyncStatus(data.updatedAt ? `已保存 ${formatTime(data.updatedAt)}` : '已保存');
      render();
      if (message) showToast(message);
    } catch (error) {
      restoreCachedSites();
      render();
      setSyncStatus('保存失败');
      showToast(error.message || '保存失败');
    }
  }

  async function apiRequest(options) {
    const response = await fetch(`${getEndpoint()}/nav-sites`, {
      ...options,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        ...(options.headers || {})
      },
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(humanizeError(data.error || `HTTP ${response.status}`));
    }
    return data;
  }

  function filteredSites() {
    const query = els.searchInput.value.trim().toLowerCase();
    return sites
      .filter((site) => {
        if (activeGroup === PINNED_GROUP && !site.pinned) return false;
        if (activeGroup !== ALL_GROUP && activeGroup !== PINNED_GROUP && site.group !== activeGroup) return false;
        if (!query) return true;
        return [site.title, site.url, site.group, site.note]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }

  function uniqueGroups() {
    return [...new Set(sites.map((site) => site.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }

  function openSearchTarget() {
    const value = els.searchInput.value.trim();
    if (!value) return;

    const directUrl = normalizeUrl(value);
    const target = directUrl && looksLikeUrl(value)
      ? directUrl
      : `https://www.google.com/search?q=${encodeURIComponent(value)}`;
    window.open(target, '_blank', 'noopener');
  }

  function openSite(site) {
    if (!site || !/^https?:\/\//i.test(site.url)) return;
    window.open(site.url, '_blank', 'noopener');
  }

  function renderIcon(host, site) {
    host.innerHTML = '';
    host.classList.remove('is-favicon-icon', 'is-image-icon', 'is-text-icon');
    host.style.backgroundColor = site.iconType === 'favicon' || site.iconType === 'image' ? 'transparent' : site.color;
    host.style.color = readableTextColor(site.color);

    if (site.iconType === 'favicon' || site.iconType === 'image') {
      const sources = site.iconType === 'image' && site.icon ? [site.icon] : faviconUrls(site.url);
      if (!sources.length) {
        renderTextIcon(host, site);
        return;
      }

      let sourceIndex = 0;
      const img = document.createElement('img');
      img.className = 'nav-site-img no-lightbox';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.src = sources[sourceIndex];
      host.classList.add(site.iconType === 'image' ? 'is-image-icon' : 'is-favicon-icon');
      img.addEventListener('error', () => {
        sourceIndex += 1;
        if (sources[sourceIndex]) {
          img.src = sources[sourceIndex];
          return;
        }
        renderTextIcon(host, site);
      });
      host.appendChild(img);
      return;
    }

    renderTextIcon(host, site);
  }

  function renderTextIcon(host, site) {
    host.innerHTML = '';
    host.classList.remove('is-favicon-icon', 'is-image-icon');
    host.classList.add('is-text-icon');
    host.style.backgroundColor = site.color;
    host.style.color = readableTextColor(site.color);
    host.textContent = site.iconType === 'emoji' && site.icon
      ? site.icon.slice(0, 4)
      : (site.icon || initials(site.title));
  }

  function updateIconPreview() {
    const url = normalizeUrl(els.siteUrl.value) || 'https://example.com/';
    renderIcon(els.iconPreview, normalizeSite({
      id: 'preview',
      title: els.siteTitle.value || hostname(url) || 'A',
      url,
      iconType: els.iconType.value,
      icon: els.siteIcon.value,
      color: els.siteColor.value || '#4285f4'
    }, 0));
  }

  function syncIconTypeUi() {
    const type = els.iconType.value;
    const needsValue = type === 'image' || type === 'emoji' || type === 'letter';
    els.iconValueField.hidden = !needsValue;

    if (type === 'image') {
      els.siteIcon.placeholder = 'https://example.com/icon.png';
      els.siteIcon.maxLength = 500;
    } else if (type === 'emoji') {
      els.siteIcon.placeholder = '🚀';
      els.siteIcon.maxLength = 8;
    } else if (type === 'letter') {
      els.siteIcon.placeholder = 'AI';
      els.siteIcon.maxLength = 2;
    }
  }

  function autofillFromUrl() {
    const url = normalizeUrl(els.siteUrl.value);
    if (!url) return;
    els.siteUrl.value = url;
    if (!els.siteTitle.value.trim()) els.siteTitle.value = hostname(url);
    if (!els.siteColor.value || els.siteColor.value === '#4285f4') els.siteColor.value = colorForText(hostname(url));
    updateIconPreview();
  }

  function normalizeSites(input) {
    const usedIds = new Set();
    return (Array.isArray(input) ? input : [])
      .map((item, index) => normalizeSite(item, index, usedIds))
      .filter(Boolean);
  }

  function normalizeSite(input, index, usedIds = new Set()) {
    const url = normalizeUrl(input && input.url);
    if (!url) return null;

    let id = String(input.id || `site-${index + 1}`).trim();
    if (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);

    const host = hostname(url);
    const iconType = ['favicon', 'image', 'emoji', 'letter', 'color'].includes(input.iconType) ? input.iconType : 'favicon';
    const color = /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : colorForText(host || id);

    return {
      id,
      title: String(input.title || input.name || host || `收藏 ${index + 1}`).trim().slice(0, 80),
      url,
      iconType,
      icon: String(input.icon || '').trim().slice(0, iconType === 'image' ? 500 : 8),
      color,
      group: String(input.group || input.category || '').trim().slice(0, 40),
      note: String(input.note || input.description || '').trim().slice(0, 180),
      pinned: Boolean(input.pinned),
      createdAt: String(input.createdAt || '').slice(0, 40),
      updatedAt: String(input.updatedAt || '').slice(0, 40)
    };
  }

  function currentSite(id) {
    return sites.find((site) => site.id === id);
  }

  function cacheSites() {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ sites }));
  }

  function restoreCachedSites() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (Array.isArray(cache.sites) && cache.sites.length) sites = normalizeSites(cache.sites);
    } catch (error) {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  function storedValue(keys) {
    return keys.map((key) => localStorage.getItem(key)).find(Boolean) || '';
  }

  function rememberAccess() {
    localStorage.setItem(ENDPOINT_KEY, getEndpoint());
    localStorage.setItem(COMMON_TOKEN_KEY, getToken());
  }

  function getEndpoint() {
    return els.endpoint.value.trim().replace(/\/+$/, '');
  }

  function getToken() {
    return els.token.value.trim();
  }

  function normalizeUrl(value) {
    let text = String(value || '').trim();
    if (!text) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
    try {
      const url = new URL(text);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.toString();
    } catch (error) {
      return '';
    }
  }

  function looksLikeUrl(value) {
    return /^https?:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+/.test(value);
  }

  function hostname(url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, '');
    } catch (error) {
      return '';
    }
  }

  function faviconUrls(url) {
    const host = hostname(url);
    const origin = originFromUrl(url);
    if (!host) return [];

    const bareHost = host.replace(/^www\./i, '');
    return unique([
      ...brandIconUrls(bareHost),
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin || url)}&size=128`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bareHost)}&sz=128`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin || url)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
      origin ? `${origin}/favicon.ico` : ''
    ].filter(Boolean));
  }

  function brandIconUrls(host) {
    const normalizedHost = String(host || '').toLowerCase();
    if (normalizedHost === 'bilibili.com' || normalizedHost.endsWith('.bilibili.com')) {
      return [svgDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
          <path d="M22.7 19.8 16.9 14l3-3 6.8 6.7h10.6l6.8-6.7 3 3-5.8 5.8c4.9.8 7.9 4.4 7.9 9.6v12c0 6.3-4.1 10-11 10H25.8c-6.9 0-11-3.7-11-10v-12c0-5.2 3-8.8 7.9-9.6Z" fill="none" stroke="#13b5e9" stroke-width="5.2" stroke-linejoin="round"/>
          <circle cx="25.2" cy="35" r="2.7" fill="#13b5e9"/>
          <circle cx="38.8" cy="35" r="2.7" fill="#13b5e9"/>
          <path d="M27 43.3h10" stroke="#13b5e9" stroke-width="4.3" stroke-linecap="round"/>
        </svg>
      `)];
    }
    return [];
  }

  function svgDataUrl(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
  }

  function originFromUrl(url) {
    try {
      return new URL(url).origin;
    } catch (error) {
      return '';
    }
  }

  function unique(items) {
    return [...new Set(items)];
  }

  function initials(value) {
    const text = String(value || '').trim();
    if (!text) return '•';
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
    return text.slice(0, 2).toUpperCase();
  }

  function colorForText(value) {
    const palette = ['#4285f4', '#34a853', '#fbbc05', '#ea4335', '#7c5cff', '#00a3a3', '#ff7aa2', '#5d6d7e'];
    const text = String(value || Date.now());
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return palette[hash % palette.length];
  }

  function nextColor() {
    return colorForText(`${Date.now()}-${sites.length}`);
  }

  function readableTextColor(hex) {
    const color = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '4285f4';
    const red = parseInt(color.slice(0, 2), 16);
    const green = parseInt(color.slice(2, 4), 16);
    const blue = parseInt(color.slice(4, 6), 16);
    return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#202124' : '#ffffff';
  }

  function createId() {
    return `site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function setLockStatus(message) {
    els.lockStatus.textContent = message;
  }

  function setSyncStatus(message) {
    els.syncStatus.textContent = message;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2600);
  }

  function humanizeError(error) {
    const map = {
      ADMIN_TOKEN_NOT_CONFIGURED: 'Cloudflare 还没有配置 ADMIN_TOKEN',
      UNAUTHORIZED: '管理员密钥不对',
      KV_NOT_CONFIGURED: 'Cloudflare KV 还没有配置',
      NAV_DATA_INVALID: '云端导航数据格式异常',
      REQUEST_TOO_LARGE: '收藏数据太大',
      INVALID_JSON: '请求格式不正确'
    };
    return map[error] || error;
  }

  init();
})();
