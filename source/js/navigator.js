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

  // v2.5修改：icon 成功源缓存
  const ICON_CACHE_KEY = 'sly_blog_navigator_icon_cache_v1';
  const ICON_TIMEOUT_MS = 2500;

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
  let iconCache = loadIconCache();

  function init() {
    injectNavigatorStyleOverrides();

    els.endpoint.value = storedValue(ENDPOINT_FALLBACK_KEYS) || app.dataset.apiEndpoint || '';
    els.token.value = storedValue(TOKEN_FALLBACK_KEYS);
    bindEvents();
    render();

    if (els.endpoint.value.trim() && els.token.value.trim()) {
      unlock({ silent: true });
    }
  }

  // v2.6修改：去掉底部“添加网站”卡片后，只保留右下角 FAB；
  // 同时把 FAB 改成更小的玻璃拟态按钮。
  function injectNavigatorStyleOverrides() {
    const styleId = 'navigator-v2-6-style-overrides';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .navigator-page #navFabAdd {
        width: 46px !important;
        height: 46px !important;
        min-width: 46px !important;
        min-height: 46px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(255, 255, 255, 0.42) !important;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.16)) !important;
        color: rgba(37, 99, 235, 0.92) !important;
        box-shadow:
          0 14px 36px rgba(15, 23, 42, 0.16),
          inset 0 1px 0 rgba(255, 255, 255, 0.72),
          inset 0 -1px 0 rgba(255, 255, 255, 0.18) !important;
        backdrop-filter: blur(18px) saturate(1.35) !important;
        -webkit-backdrop-filter: blur(18px) saturate(1.35) !important;
        opacity: 0.88 !important;
        transform: translateZ(0) !important;
        transition:
          transform 180ms ease,
          opacity 180ms ease,
          box-shadow 180ms ease,
          background 180ms ease !important;
      }

      .navigator-page #navFabAdd:hover {
        opacity: 1 !important;
        transform: translateY(-2px) scale(1.035) !important;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0.22)) !important;
        box-shadow:
          0 18px 42px rgba(15, 23, 42, 0.20),
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          inset 0 -1px 0 rgba(255, 255, 255, 0.22) !important;
      }

      .navigator-page #navFabAdd:active {
        transform: translateY(0) scale(0.97) !important;
        opacity: 0.96 !important;
      }

      .navigator-page #navFabAdd i,
      .navigator-page #navFabAdd svg {
        font-size: 18px !important;
        width: 18px !important;
        height: 18px !important;
        line-height: 1 !important;
      }

      .navigator-page #navFabAdd::before,
      .navigator-page #navFabAdd::after {
        box-shadow: none !important;
      }

      @media (prefers-color-scheme: dark) {
        .navigator-page #navFabAdd {
          border-color: rgba(255, 255, 255, 0.18) !important;
          background:
            linear-gradient(135deg, rgba(30, 41, 59, 0.62), rgba(15, 23, 42, 0.34)) !important;
          color: rgba(147, 197, 253, 0.96) !important;
          box-shadow:
            0 14px 36px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.20),
            inset 0 -1px 0 rgba(255, 255, 255, 0.08) !important;
        }

        .navigator-page #navFabAdd:hover {
          background:
            linear-gradient(135deg, rgba(51, 65, 85, 0.72), rgba(15, 23, 42, 0.42)) !important;
        }
      }
    `;
    document.head.appendChild(style);
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
    let visibleTabCount = 0;
    if (sites.some((site) => site.pinned)) addGroupTab(PINNED_GROUP, '置顶');
    groups.forEach((group) => addGroupTab(group, group));
    els.groupTabs.hidden = visibleTabCount === 0;

    function addGroupTab(value, label) {
      const button = document.createElement('button');
      button.className = `nav-group-tab${activeGroup === value ? ' is-active' : ''}`;
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => {
        activeGroup = activeGroup === value ? ALL_GROUP : value;
        render();
      });
      els.groupTabs.appendChild(button);
      visibleTabCount += 1;
    }
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

    // v2.6修改：删除收藏列表最后的“添加网站”卡片。
    // 现在只使用右下角玻璃风格加号按钮添加网站。
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

    card.append(icon);
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

    if (site.iconType === 'favicon' || site.iconType === 'image') {
      host.style.removeProperty('background-color');
    } else {
      host.style.backgroundColor = site.color;
    }

    host.style.color = readableTextColor(site.color);

    if (site.iconType === 'favicon' || site.iconType === 'image') {
      const hostName = hostname(site.url);
      const cacheKey = site.iconType === 'favicon' ? faviconCacheKey(site.url) : '';
      const cachedIcon = cacheKey ? iconCache[cacheKey] : '';

      const brandSources = site.iconType === 'favicon'
        ? brandIconUrls(hostName)
        : [];

      const sources = site.iconType === 'image' && site.icon
        ? [site.icon]
        : unique([
            // v2.5修改：所有网站都先尝试 SimpleIcons 彩色品牌 SVG。
            // 成功就是原来那种干净的品牌图标；失败才进入缓存和 favicon 贴图。
            ...brandSources,

            // v2.5修改：旧缓存可能是 Google 贴图，也可能是之前误存的黑色图。
            // 放在品牌图标之后，不能压过品牌 SVG。
            cachedIcon,

            ...faviconUrls(site.url)
          ].filter(Boolean));

      if (!sources.length) {
        renderTextIcon(host, site);
        return;
      }

      let sourceIndex = 0;
      let timeoutTimer = null;
      let finished = false;

      const img = document.createElement('img');
      img.className = 'nav-site-img no-lightbox';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'eager';
      img.referrerPolicy = 'no-referrer';

      host.classList.add(site.iconType === 'image' ? 'is-image-icon' : 'is-favicon-icon');

      function clearIconTimer() {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      }

      function finishAsTextIcon() {
        if (finished) return;
        finished = true;
        clearIconTimer();
        renderTextIcon(host, site);
      }

      function saveGoodIconSource(src) {
        if (!cacheKey || !src) return;

        // v2.5修改：不要把之前黑色强制色的 iconify/simpleicons 缓存下来
        if (isForcedBlackIconUrl(src)) return;

        // v2.5修改：如果是品牌网站，不让 Google favicon 覆盖品牌 SVG
        if (brandSources.length && isGoogleFaviconUrl(src)) return;

        if (iconCache[cacheKey] === src) return;

        iconCache[cacheKey] = src;
        saveIconCache();
      }

      function tryNextIcon() {
        if (finished) return;

        clearIconTimer();
        sourceIndex += 1;

        if (sources[sourceIndex]) {
          loadIconSource();
          return;
        }

        finishAsTextIcon();
      }

      function loadIconSource() {
        if (finished) return;

        clearIconTimer();

        timeoutTimer = setTimeout(() => {
          tryNextIcon();
        }, ICON_TIMEOUT_MS);

        img.src = sources[sourceIndex];
      }

      img.addEventListener('load', () => {
        if (finished) return;
        clearIconTimer();
        saveGoodIconSource(img.currentSrc || img.src);
      });

      img.addEventListener('error', () => {
        tryNextIcon();
      });

      host.appendChild(img);
      loadIconSource();
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

  function originFromUrl(url) {
    try {
      return new URL(url).origin;
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
      // v2.5修改：品牌 SVG 失败后，才使用稳定 favicon 源
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bareHost)}&sz=128`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin || url)}&sz=128`,
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin || url)}&size=128`,

      origin ? `${origin}/favicon.ico` : '',
      origin ? `${origin}/favicon.png` : '',
      origin ? `${origin}/apple-touch-icon.png` : '',
      origin ? `${origin}/apple-touch-icon-precomposed.png` : '',

      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(bareHost)}.ico`,
      `https://icon.horse/icon/${encodeURIComponent(host)}`,
      `https://unavatar.io/${encodeURIComponent(host)}`
    ].filter(Boolean));
  }

  function brandIconUrls(host) {
    const labels = brandSlugCandidates(host);

    // v2.5修改：
    // 只用 cdn.simpleicons.org/{slug}
    // 不再使用 iconify 的 color=#111111，也不再使用 simpleicons 的 /111111 强制黑色写法。
    // SimpleIcons 默认会给品牌色，例如 YouTube 红色、Bilibili 蓝色。
    return unique(labels.flatMap((slug) => [
      `https://cdn.simpleicons.org/${encodeURIComponent(slug)}`
    ]));
  }

  function brandSlugCandidates(host) {
    const normalized = String(host || '')
      .toLowerCase()
      .replace(/^www\./i, '');

    const hostAliases = {
      'bilibili.com': ['bilibili'],
      'm.bilibili.com': ['bilibili'],
      'space.bilibili.com': ['bilibili'],
      'live.bilibili.com': ['bilibili'],
      'youtube.com': ['youtube'],
      'm.youtube.com': ['youtube'],
      'youtu.be': ['youtube'],
      'music.youtube.com': ['youtubemusic', 'youtube'],
      'chatgpt.com': ['openai'],
      'openai.com': ['openai'],
      'platform.openai.com': ['openai'],
      'github.com': ['github'],
      'gist.github.com': ['github']
    };

    if (hostAliases[normalized]) return hostAliases[normalized];

    const parts = normalized.split('.').filter(Boolean);
    const ignoreParts = new Set([
      'www', 'm', 'mobile', 'app', 'web', 'mail', 'docs', 'blog',
      'com', 'cn', 'net', 'org', 'io', 'ai', 'app', 'dev', 'co',
      'top', 'xyz', 'site', 'me', 'tv', 'cc', 'edu', 'gov'
    ]);

    const usefulParts = parts.filter((part) => !ignoreParts.has(part));
    const firstUseful = usefulParts[0] || parts[0] || '';
    const secondUseful = usefulParts[1] || '';

    const compact = firstUseful.replace(/[^a-z0-9]/g, '');
    const compact2 = secondUseful.replace(/[^a-z0-9]/g, '');

    const aliases = {
      chatgpt: ['openai'],
      openai: ['openai'],
      youtube: ['youtube'],
      youtu: ['youtube'],
      bilibili: ['bilibili'],
      github: ['github'],
      gitlab: ['gitlab'],
      gitee: ['gitee'],
      zhihu: ['zhihu'],
      juejin: ['juejin'],
      csdn: ['csdn'],
      notion: ['notion'],
      obsidian: ['obsidian'],
      figma: ['figma'],
      twitter: ['x'],
      x: ['x'],
      reddit: ['reddit'],
      stackoverflow: ['stackoverflow'],
      npmjs: ['npm'],
      npm: ['npm'],
      docker: ['docker'],
      dockerhub: ['docker'],
      cloudflare: ['cloudflare'],
      vercel: ['vercel'],
      netlify: ['netlify'],
      apple: ['apple'],
      google: ['google'],
      gmail: ['gmail'],
      drive: ['googledrive'],
      baidu: ['baidu'],
      bing: ['bing'],
      microsoft: ['microsoft'],
      vscode: ['visualstudiocode'],
      code: ['visualstudiocode'],
      python: ['python'],
      arxiv: ['arxiv'],
      overleaf: ['overleaf'],
      zotero: ['zotero']
    };

    return unique([
      ...(aliases[compact] || []),
      ...(aliases[compact2] || []),
      compact
    ].filter(Boolean));
  }

  function isGoogleFaviconUrl(src) {
    return /(^https:\/\/www\.google\.com\/s2\/favicons)|(^https:\/\/t2\.gstatic\.com\/faviconV2)/i.test(String(src || ''));
  }

  function isForcedBlackIconUrl(src) {
    const text = String(src || '');
    return /cdn\.simpleicons\.org\/[^/]+\/111111/i.test(text)
      || /api\.iconify\.design\/simple-icons:.*color=%23111111/i.test(text)
      || /api\.iconify\.design\/simple-icons:.*color=#111111/i.test(text);
  }

  function faviconCacheKey(url) {
    const host = hostname(url);
    return host ? host.toLowerCase() : '';
  }

  function loadIconCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(ICON_CACHE_KEY) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

      // v2.5修改：启动时清理之前保存过的黑色强制图标缓存
      const cleaned = {};
      Object.entries(raw).forEach(([key, value]) => {
        if (typeof value === 'string' && !isForcedBlackIconUrl(value)) {
          cleaned[key] = value;
        }
      });

      return cleaned;
    } catch (error) {
      localStorage.removeItem(ICON_CACHE_KEY);
      return {};
    }
  }

  function saveIconCache() {
    try {
      localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(iconCache));
    } catch (error) {
      iconCache = {};
      localStorage.removeItem(ICON_CACHE_KEY);
    }
  }

  function siteIconUrls(url, bareHost, origin) {
    const origins = unique([
      origin,
      bareHost ? `https://${bareHost}` : '',
      bareHost ? `http://${bareHost}` : ''
    ].filter(Boolean));

    return origins.flatMap((item) => [
      `${item}/favicon.ico`,
      `${item}/favicon.png`,
      `${item}/apple-touch-icon.png`,
      `${item}/apple-touch-icon-precomposed.png`
    ]);
  }

  function svgDataUrl(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
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