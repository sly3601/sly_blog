(function () {
  const STORAGE_KEY = 'sly_blog_skill_tree_v3';
  const LEGACY_STORAGE_KEYS = ['sly_blog_skill_tree_v2', 'sly_blog_skill_tree_v1'];
  const CLOUD_ENDPOINT_KEY = 'sly_blog_skill_tree_cloud_endpoint';
  const CLOUD_TOKEN_KEY = 'sly_blog_skill_tree_cloud_token';
  const WORLD = { width: 3600, height: 2400 };
  const NODE_SIZE = { width: 244, height: 104 };
  const stateLabels = {
    locked: '未解锁',
    current: '修炼中',
    done: '已掌握',
    master: '宗师'
  };

  const app = document.getElementById('skill-tree-app');
  if (!app) return;

  const cloudConfig = {
    endpoint: app.dataset.cloudEndpoint || '',
    autoLoad: app.dataset.cloudAutoload !== 'false'
  };
  document.body.classList.add('skill-tree-page');

  const els = {
    viewport: document.getElementById('skillViewport'),
    world: document.getElementById('skillWorld'),
    links: document.getElementById('skillLinks'),
    nodes: document.getElementById('skillNodes'),
    toast: document.getElementById('skillToast'),
    status: document.getElementById('skillStatus'),
    addChild: document.getElementById('skillAddChild'),
    addSibling: document.getElementById('skillAddSibling'),
    delete: document.getElementById('skillDelete'),
    layout: document.getElementById('skillLayout'),
    save: document.getElementById('skillSave'),
    export: document.getElementById('skillExport'),
    import: document.getElementById('skillImport'),
    cloudLoad: document.getElementById('skillCloudLoad'),
    cloudSave: document.getElementById('skillCloudSave'),
    importFile: document.getElementById('skillImportFile'),
    cloudEndpoint: document.getElementById('skillCloudEndpoint'),
    cloudToken: document.getElementById('skillCloudToken'),
    cloudClear: document.getElementById('skillCloudClear'),
    cloudBadge: document.getElementById('skillCloudBadge'),
    reset: document.getElementById('skillReset'),
    zoomIn: document.getElementById('skillZoomIn'),
    zoomOut: document.getElementById('skillZoomOut'),
    fit: document.getElementById('skillFit'),
    title: document.getElementById('skillTitle'),
    subtitle: document.getElementById('skillSubtitle'),
    icon: document.getElementById('skillIcon'),
    state: document.getElementById('skillState'),
    perk: document.getElementById('skillPerk'),
    domainChoices: document.getElementById('skillDomainChoices'),
    prereqChoices: document.getElementById('skillPrereqChoices'),
    link: document.getElementById('skillLink'),
    notes: document.getElementById('skillNotes')
  };

  let tree = loadTree();
  let selectedId = tree.selectedId || 'root';
  let dragNode = null;
  let panState = null;
  let saveTimer = null;
  let toastTimer = null;
  let suppressClick = false;

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

  function starterTree() {
    return {
      version: 3,
      layout: 'free-cross-tree',
      selectedId: 'root',
      view: { x: 0, y: 0, scale: 0.78 },
      domains: defaultDomains(),
      nodes: [
        node('root', [], '机器人全栈起点', '从这里长出跨领域能力', '✦', 'master', ['core'], 1680, 1140, '+1 全局学习效率'),
        node('math', ['root'], '数学与工程基础', '线代、概率、优化、系统思维', '∑', 'done', ['core'], 1260, 820, '+1 建模能力'),
        node('coding', ['root'], '工程编程', 'Python、C++、数据结构', '⌘', 'done', ['core', 'deploy'], 1260, 1460, '+1 实现速度'),
        node('cv', ['math'], '视觉感知', '检测、分割、特征与相机', '◉', 'done', ['perception'], 760, 580, '+1 图像理解'),
        node('lidar', ['math'], '点云与建图', '深度、雷达、SLAM 基础', '◎', 'current', ['perception'], 820, 1030, '+1 空间理解'),
        node('sensor-fusion', ['cv', 'lidar'], '多传感器融合', '视觉、点云、状态估计汇聚', '✹', 'current', ['perception', 'ai'], 1110, 820, '+1 融合推理'),
        node('planning', ['math'], '运动规划', '路径、轨迹、约束与代价', '↝', 'current', ['control'], 2020, 610, '+1 轨迹规划'),
        node('control-loop', ['planning'], '闭环控制', 'PID、MPC、状态反馈', '⚙', 'current', ['control'], 2360, 780, '+1 控制稳定性'),
        node('simulation', ['coding', 'planning'], '仿真训练', 'Gazebo、Mujoco、Isaac', '▤', 'current', ['control', 'deploy'], 2120, 1190, '+1 验证效率'),
        node('data-engineering', ['coding'], '数据工程', '采集、清洗、标注与版本', '▦', 'done', ['ai', 'deploy'], 1030, 1700, '+1 数据质量'),
        node('model-training', ['data-engineering', 'cv'], '模型训练', '训练、评测、迭代', '◆', 'current', ['ai'], 1360, 1840, '+1 模型能力'),
        node('sim2real', ['sensor-fusion', 'control-loop', 'simulation', 'model-training'], 'Sim2Real 闭环', '感知、控制、模型共同落地', '⎈', 'locked', ['perception', 'control', 'ai'], 1780, 1480, '解锁真机验证'),
        node('web-fullstack', ['coding'], 'Web 全栈', '前端、后端、数据库、后台', '▣', 'done', ['deploy'], 2470, 1540, '+1 产品闭环'),
        node('cloud-service', ['web-fullstack', 'simulation'], '云端服务', 'CI/CD、Worker、监控', '☁', 'current', ['deploy'], 2750, 1220, '+1 服务稳定性'),
        node('robot-agent', ['sensor-fusion', 'sim2real', 'cloud-service', 'model-training'], '机器人 Agent', '规划、工具、记忆、执行', '✺', 'locked', ['ai', 'control', 'deploy'], 2220, 1750, '解锁智能体项目'),
        node('writing', ['root'], '内容输出', '博客、教程、案例复盘', '✎', 'done', ['business'], 730, 1470, '+1 表达力'),
        node('course-system', ['writing', 'model-training'], '课程体系', '知识地图、作业、训练营', '♜', 'current', ['business', 'ai'], 1080, 1320, '+1 课程转化'),
        node('consulting', ['course-system', 'robot-agent', 'web-fullstack'], '咨询交付', '机器人知识付费与项目方案', '₿', 'locked', ['business', 'deploy', 'ai'], 2620, 1890, '解锁商业案例'),
        node('capstone', ['sim2real', 'robot-agent', 'consulting'], '代表性项目', '能展示、能复用、能交付', '✦', 'master', ['core', 'business', 'deploy'], 3060, 1540, '+1 个人品牌')
      ]
    };
  }

  function node(id, parents, title, subtitle, icon, state, domains, x, y, perk) {
    return { id, parents, title, subtitle, icon, state, domains, x, y, perk, link: '', notes: '' };
  }

  function loadTree() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
      if (!stored) return starterTree();
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.nodes) || !parsed.nodes.length) return starterTree();
      return normalizeTree(parsed);
    } catch (error) {
      console.warn('Skill tree data is invalid, using starter tree.', error);
      return starterTree();
    }
  }

  function normalizeTree(data) {
    const domains = normalizeDomains(data.domains || data.branches);
    const domainIds = domains.map((domain) => domain.id);
    const ids = new Set((data.nodes || []).map((item) => String(item.id || '')));

    const nodes = data.nodes.map((rawNode, index) => {
      const id = String(rawNode.id || createId());
      const legacyDomain = rawNode.branch || domainIds[index % domainIds.length];
      const rawDomains = Array.isArray(rawNode.domains)
        ? rawNode.domains
        : [legacyDomain];
      const nodeDomains = rawDomains.filter((domain) => domainIds.includes(domain));
      const parents = Array.isArray(rawNode.parents)
        ? rawNode.parents
        : rawNode.parent
          ? [rawNode.parent]
          : [];
      const fallbackPosition = legacyPosition(rawNode, index, domainIds, legacyDomain);
      return {
        id,
        parents: parents.map(String).filter((parentId) => parentId !== id && ids.has(parentId)),
        title: String(rawNode.title || (index === 0 ? '机器人全栈起点' : '新技能')),
        subtitle: String(rawNode.subtitle || ''),
        icon: String(rawNode.icon || domainIcon(domains, nodeDomains[0]) || '✦').slice(0, 2),
        state: stateLabels[rawNode.state] ? rawNode.state : 'current',
        domains: nodeDomains.length ? nodeDomains : [domainIds[0]],
        x: Number.isFinite(Number(rawNode.x)) && Number(rawNode.x) > 0 ? Number(rawNode.x) : fallbackPosition.x,
        y: Number.isFinite(Number(rawNode.y)) && Number(rawNode.y) > 0 ? Number(rawNode.y) : fallbackPosition.y,
        perk: String(rawNode.perk || ''),
        link: String(rawNode.link || ''),
        notes: String(rawNode.notes || '')
      };
    });

    if (!nodes.some((item) => item.id === 'root')) {
      nodes[0].id = 'root';
      nodes[0].parents = [];
      nodes[0].state = 'master';
    }

    const validIds = new Set(nodes.map((item) => item.id));
    nodes.forEach((item) => {
      if (item.id === 'root') item.parents = [];
      item.parents = [...new Set(item.parents.filter((parentId) => validIds.has(parentId) && parentId !== item.id))];
      item.x = clamp(item.x, 120, WORLD.width - 120);
      item.y = clamp(item.y, 90, WORLD.height - 90);
    });

    return {
      version: 3,
      layout: 'free-cross-tree',
      selectedId: data.selectedId || 'root',
      view: {
        x: Number.isFinite(Number(data.view && data.view.x)) ? Number(data.view.x) : 0,
        y: Number.isFinite(Number(data.view && data.view.y)) ? Number(data.view.y) : 0,
        scale: Number.isFinite(Number(data.view && data.view.scale)) ? clamp(Number(data.view.scale), 0.38, 1.55) : 0.78
      },
      domains,
      nodes
    };
  }

  function normalizeDomains(input) {
    const fallback = defaultDomains();
    if (!Array.isArray(input) || !input.length) return fallback;
    const used = new Set();
    return input.slice(0, 10).map((domain, index) => {
      const fallbackDomain = fallback[index % fallback.length];
      let id = String(domain.id || fallbackDomain.id || `domain-${index + 1}`).trim();
      if (!id || used.has(id)) id = `domain-${index + 1}`;
      used.add(id);
      return {
        id,
        title: String(domain.title || fallbackDomain.title || `领域 ${index + 1}`),
        icon: String(domain.icon || fallbackDomain.icon || '◆').slice(0, 2),
        color: /^#[0-9a-f]{6}$/i.test(domain.color || '') ? domain.color : fallbackDomain.color
      };
    });
  }

  function legacyPosition(rawNode, index, domainIds, legacyDomain) {
    if (rawNode.tier || rawNode.branch) {
      const domainIndex = Math.max(0, domainIds.indexOf(legacyDomain));
      return {
        x: 700 + clamp(Number(rawNode.tier || 1), 1, 6) * 360,
        y: 480 + domainIndex * 260 + Number(rawNode.slot || 0) * 96
      };
    }
    return {
      x: 720 + (index % 5) * 430,
      y: 460 + Math.floor(index / 5) * 330
    };
  }

  function getNode(id) {
    return tree.nodes.find((item) => item.id === id);
  }

  function getChildren(id) {
    return tree.nodes.filter((item) => item.parents.includes(id));
  }

  function getDomain(id) {
    return tree.domains.find((domain) => domain.id === id) || tree.domains[0];
  }

  function domainIcon(domains, id) {
    const domain = domains.find((item) => item.id === id);
    return domain && domain.icon;
  }

  function nodeMainDomain(item) {
    return getDomain((item.domains && item.domains[0]) || tree.domains[0].id);
  }

  function nodeGradient(item) {
    const colors = item.domains.map((id) => getDomain(id).color).slice(0, 3);
    if (colors.length <= 1) return colors[0] || '#f2c35b';
    if (colors.length === 2) return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
    return `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]})`;
  }

  function createId() {
    return `skill-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^(https?:\/\/|\/)/i.test(url)) return url;
    return '';
  }

  function normalizeEndpoint(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function getCloudEndpoint() {
    return normalizeEndpoint(els.cloudEndpoint && els.cloudEndpoint.value);
  }

  function getCloudToken() {
    return String((els.cloudToken && els.cloudToken.value) || '').trim();
  }

  function rememberCloudConfig() {
    const endpoint = getCloudEndpoint();
    const token = getCloudToken();
    if (endpoint) localStorage.setItem(CLOUD_ENDPOINT_KEY, endpoint);
    else localStorage.removeItem(CLOUD_ENDPOINT_KEY);
    if (token) localStorage.setItem(CLOUD_TOKEN_KEY, token);
    else localStorage.removeItem(CLOUD_TOKEN_KEY);
    updateCloudBadge();
  }

  function initCloudControls() {
    const configuredEndpoint = normalizeEndpoint(cloudConfig.endpoint);
    const storedEndpoint = normalizeEndpoint(localStorage.getItem(CLOUD_ENDPOINT_KEY));
    const storedToken = localStorage.getItem(CLOUD_TOKEN_KEY) || '';
    const shouldUseConfigured = configuredEndpoint && (!storedEndpoint || storedEndpoint.includes('workers.dev'));
    els.cloudEndpoint.value = shouldUseConfigured ? configuredEndpoint : (storedEndpoint || configuredEndpoint || '');
    els.cloudToken.value = storedToken;
    if (shouldUseConfigured) localStorage.setItem(CLOUD_ENDPOINT_KEY, configuredEndpoint);
    updateCloudBadge();
  }

  function updateCloudBadge(mode) {
    els.cloudBadge.classList.remove('is-ready', 'is-error');
    if (mode === 'error') {
      els.cloudBadge.textContent = '连接失败';
      els.cloudBadge.classList.add('is-error');
      return;
    }
    if (mode === 'saved') {
      els.cloudBadge.textContent = '云端已保存';
      els.cloudBadge.classList.add('is-ready');
      return;
    }
    if (mode === 'loaded') {
      els.cloudBadge.textContent = '云端已读取';
      els.cloudBadge.classList.add('is-ready');
      return;
    }
    if (getCloudEndpoint()) {
      els.cloudBadge.textContent = '已配置';
      els.cloudBadge.classList.add('is-ready');
    } else {
      els.cloudBadge.textContent = '未配置';
    }
  }

  function cloudApiUrl() {
    const endpoint = getCloudEndpoint();
    return endpoint ? `${endpoint}/skill-tree` : '';
  }

  async function loadCloudTree(options = {}) {
    const url = cloudApiUrl();
    if (!url) {
      showToast('先填写云端接口地址');
      updateCloudBadge();
      return false;
    }

    try {
      setStatus('正在读取云端...');
      rememberCloudConfig();
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (response.status === 404) {
        if (!options.silent) showToast('云端还没有数据，先点一次云端保存');
        setStatus('云端暂无数据');
        return false;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      tree = normalizeTree(payload && payload.tree ? payload.tree : payload);
      selectedId = tree.selectedId || 'root';
      render();
      if (options.fit !== false) fitToTree();
      saveTree();
      setStatus('云端已同步');
      updateCloudBadge('loaded');
      if (!options.silent) showToast('已从云端读取技能树');
      return true;
    } catch (error) {
      console.error(error);
      updateCloudBadge('error');
      setStatus('云端读取失败');
      if (!options.silent) showToast('云端读取失败，已保留本地数据');
      return false;
    }
  }

  async function saveCloudTree() {
    const url = cloudApiUrl();
    if (!url) {
      showToast('先填写云端接口地址');
      updateCloudBadge();
      return;
    }

    let token = getCloudToken();
    if (!token) {
      token = window.prompt('请输入管理员密钥，密钥只会保存在当前浏览器：') || '';
      if (!token.trim()) {
        showToast('已取消云端保存');
        return;
      }
      els.cloudToken.value = token.trim();
    }

    try {
      rememberCloudConfig();
      saveTree();
      setStatus('正在保存到云端...');
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.trim()}`
        },
        body: JSON.stringify(tree)
      });
      if (response.status === 401 || response.status === 403) {
        showToast('管理员密钥不对，云端没有保存');
        setStatus('云端保存失败');
        updateCloudBadge('error');
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json().catch(() => null);
      if (payload && payload.tree) {
        tree = normalizeTree(payload.tree);
        selectedId = tree.selectedId || selectedId;
        render();
        saveTree();
      }
      setStatus('云端已保存');
      updateCloudBadge('saved');
      showToast('已保存到云端，访客刷新后会看到新版');
    } catch (error) {
      console.error(error);
      setStatus('云端保存失败');
      updateCloudBadge('error');
      showToast('云端保存失败，本地数据仍已保留');
    }
  }

  function render() {
    if (!getNode(selectedId)) selectedId = 'root';
    tree.selectedId = selectedId;
    renderLinks();
    renderNodes();
    renderForm();
    applyView();
  }

  function renderLinks() {
    const paths = [];
    tree.nodes.forEach((item) => {
      item.parents.forEach((parentId) => {
        const parent = getNode(parentId);
        if (!parent) return;
        const color = nodeMainDomain(item).color;
        const startX = parent.x;
        const startY = parent.y;
        const endX = item.x;
        const endY = item.y;
        const dx = Math.max(110, Math.abs(endX - startX) * 0.5);
        const d = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
        paths.push(`<path class="skill-link-path-shadow" d="${d}"></path><path class="skill-link-path ${item.state}" d="${d}" style="stroke:${escapeHtml(color)}"></path>`);
      });
    });
    els.links.innerHTML = paths.join('');
  }

  function renderNodes() {
    els.nodes.innerHTML = `${renderDomainLegend()}${tree.nodes.map(renderNode).join('')}`;
    els.nodes.querySelectorAll('.skill-node').forEach((nodeEl) => {
      nodeEl.addEventListener('pointerdown', startNodeDrag);
      nodeEl.addEventListener('click', (event) => {
        if (event.target.closest('a')) return;
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        selectedId = nodeEl.dataset.id;
        render();
        scheduleSave();
      });
      nodeEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectedId = nodeEl.dataset.id;
        render();
        scheduleSave();
      });
    });
  }

  function renderDomainLegend() {
    return `<div class="skill-domain-legend">${tree.domains.map((domain) => `
      <span class="skill-domain-pill" style="--domain-color:${escapeHtml(domain.color)}">
        <i>${escapeHtml(domain.icon)}</i>${escapeHtml(domain.title)}
      </span>
    `).join('')}</div>`;
  }

  function renderNode(item) {
    const mainDomain = nodeMainDomain(item);
    const url = safeUrl(item.link);
    const prereqText = item.parents.length ? `前置 x${item.parents.length}` : '起点';
    const childText = `分叉 x${getChildren(item.id).length}`;
    const domainChips = item.domains.map((domainId) => {
      const domain = getDomain(domainId);
      return `<span class="skill-node-domain" style="--domain-color:${escapeHtml(domain.color)}">${escapeHtml(domain.icon)}</span>`;
    }).join('');
    return `
      <div class="skill-node ${item.state} ${item.id === selectedId ? 'is-selected' : ''}" data-id="${escapeHtml(item.id)}" role="button" tabindex="0" style="left:${item.x}px;top:${item.y}px;--domain-color:${escapeHtml(mainDomain.color)};--domain-fill:${escapeHtml(nodeGradient(item))}">
        <span class="skill-node-emblem">${escapeHtml(item.icon || mainDomain.icon || '✦')}</span>
        <span class="skill-node-body">
          <span class="skill-node-title">${escapeHtml(item.title)}</span>
          <span class="skill-node-subtitle">${escapeHtml(item.subtitle || item.notes || '点击左侧面板编辑')}</span>
          <span class="skill-node-perk">${escapeHtml(item.perk || '未设置增益')}</span>
          <span class="skill-node-meta">
            <span class="skill-node-state">${stateLabels[item.state] || '修炼中'}</span>
            <span>${prereqText}</span>
            <span>${childText}</span>
            ${url ? `<a class="skill-node-link" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="打开链接"><i class="fas fa-external-link-alt"></i></a>` : ''}
          </span>
          <span class="skill-node-domains">${domainChips}</span>
        </span>
      </div>
    `;
  }

  function renderForm() {
    const item = getNode(selectedId);
    if (!item) return;
    els.title.value = item.title;
    els.subtitle.value = item.subtitle;
    els.icon.value = item.icon;
    els.state.value = item.state;
    els.perk.value = item.perk;
    els.link.value = item.link;
    els.notes.value = item.notes;
    renderDomainChoices(item);
    renderPrereqChoices(item);
    els.delete.disabled = item.id === 'root';
    els.addSibling.disabled = item.id === 'root';
  }

  function renderDomainChoices(item) {
    els.domainChoices.innerHTML = tree.domains.map((domain) => `
      <label class="skill-choice" style="--domain-color:${escapeHtml(domain.color)}">
        <input type="checkbox" value="${escapeHtml(domain.id)}" ${item.domains.includes(domain.id) ? 'checked' : ''}>
        <span><i>${escapeHtml(domain.icon)}</i>${escapeHtml(domain.title)}</span>
      </label>
    `).join('');
    els.domainChoices.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', updateSelectedFromForm);
    });
  }

  function renderPrereqChoices(item) {
    const descendants = new Set(collectDescendants(item.id));
    els.prereqChoices.innerHTML = tree.nodes
      .filter((candidate) => candidate.id !== item.id && !descendants.has(candidate.id))
      .map((candidate) => `
        <label class="skill-choice skill-choice-compact" style="--domain-color:${escapeHtml(nodeMainDomain(candidate).color)}">
          <input type="checkbox" value="${escapeHtml(candidate.id)}" ${item.parents.includes(candidate.id) ? 'checked' : ''}>
          <span><i>${escapeHtml(candidate.icon || nodeMainDomain(candidate).icon)}</i>${escapeHtml(candidate.title)}</span>
        </label>
      `).join('');
    els.prereqChoices.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', updateSelectedFromForm);
    });
  }

  function applyView() {
    tree.view.scale = clamp(tree.view.scale, 0.38, 1.55);
    els.world.style.transform = `translate(${tree.view.x}px, ${tree.view.y}px) scale(${tree.view.scale})`;
  }

  function updateSelectedFromForm() {
    const item = getNode(selectedId);
    if (!item) return;
    item.title = els.title.value.trim() || '未命名技能';
    item.subtitle = els.subtitle.value.trim();
    item.icon = (els.icon.value.trim() || nodeMainDomain(item).icon || '✦').slice(0, 2);
    item.state = els.state.value;
    item.perk = els.perk.value.trim();
    item.link = els.link.value.trim();
    item.notes = els.notes.value.trim();
    item.domains = [...els.domainChoices.querySelectorAll('input:checked')].map((input) => input.value);
    if (!item.domains.length) item.domains = [tree.domains[0].id];
    if (item.id !== 'root') {
      item.parents = [...els.prereqChoices.querySelectorAll('input:checked')].map((input) => input.value);
    }
    render();
    scheduleSave();
  }

  function addNode(parentId) {
    const parent = getNode(parentId) || getNode('root');
    const item = {
      id: createId(),
      parents: [parent.id],
      title: '新技能',
      subtitle: '点击左侧编辑',
      icon: nodeMainDomain(parent).icon,
      state: 'current',
      domains: [...parent.domains],
      x: clamp(parent.x + 330, 120, WORLD.width - 120),
      y: clamp(parent.y + (getChildren(parent.id).length - 0.5) * 132, 90, WORLD.height - 90),
      perk: '+1 新能力',
      link: '',
      notes: ''
    };
    tree.nodes.push(item);
    selectedId = item.id;
    render();
    saveTree('已添加子节点');
  }

  function addSibling() {
    const current = getNode(selectedId);
    if (!current || current.id === 'root') return;
    const item = {
      id: createId(),
      parents: [...current.parents],
      title: '同级技能',
      subtitle: '点击左侧编辑',
      icon: current.icon,
      state: 'current',
      domains: [...current.domains],
      x: clamp(current.x + 40, 120, WORLD.width - 120),
      y: clamp(current.y + 150, 90, WORLD.height - 90),
      perk: '+1 分支能力',
      link: '',
      notes: ''
    };
    tree.nodes.push(item);
    selectedId = item.id;
    render();
    saveTree('已添加同级节点');
  }

  function deleteSelected() {
    const item = getNode(selectedId);
    if (!item || item.id === 'root') return;
    const descendants = collectDescendants(item.id);
    const ok = window.confirm(`确定删除「${item.title}」以及 ${descendants.length} 个子节点吗？`);
    if (!ok) return;
    const removeIds = new Set([item.id, ...descendants]);
    tree.nodes = tree.nodes.filter((candidate) => !removeIds.has(candidate.id));
    tree.nodes.forEach((candidate) => {
      candidate.parents = candidate.parents.filter((parentId) => !removeIds.has(parentId));
      if (!candidate.parents.length && candidate.id !== 'root') candidate.parents = ['root'];
    });
    selectedId = 'root';
    render();
    saveTree('已删除节点');
  }

  function collectDescendants(id) {
    const result = [];
    const stack = getChildren(id).map((item) => item.id);
    while (stack.length) {
      const childId = stack.pop();
      if (result.includes(childId)) continue;
      result.push(childId);
      stack.push(...getChildren(childId).map((item) => item.id));
    }
    return result;
  }

  function autoLayout() {
    const depthMap = computeDepths();
    const domainRows = new Map(tree.domains.map((domain, index) => [domain.id, index]));
    const buckets = new Map();
    tree.nodes.forEach((item) => {
      const depth = depthMap.get(item.id) || 0;
      const domainIndex = domainRows.get(item.domains[0]) || 0;
      const key = `${depth}:${domainIndex}`;
      const count = buckets.get(key) || 0;
      buckets.set(key, count + 1);
      item.x = 520 + depth * 430 + count * 48;
      item.y = 330 + domainIndex * 300 + count * 124;
    });
    fitToTree();
    render();
    saveTree('已自动整理自由图');
  }

  function computeDepths() {
    const depths = new Map();
    function depth(id, seen = new Set()) {
      if (depths.has(id)) return depths.get(id);
      const item = getNode(id);
      if (!item || !item.parents.length || seen.has(id)) {
        depths.set(id, 0);
        return 0;
      }
      seen.add(id);
      const value = Math.max(...item.parents.map((parentId) => depth(parentId, seen))) + 1;
      depths.set(id, clamp(value, 0, 7));
      return depths.get(id);
    }
    tree.nodes.forEach((item) => depth(item.id));
    return depths;
  }

  function fitToTree() {
    const bounds = tree.nodes.reduce((acc, item) => ({
      minX: Math.min(acc.minX, item.x),
      maxX: Math.max(acc.maxX, item.x),
      minY: Math.min(acc.minY, item.y),
      maxY: Math.max(acc.maxY, item.y)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    const width = Math.max(bounds.maxX - bounds.minX + NODE_SIZE.width + 260, 760);
    const height = Math.max(bounds.maxY - bounds.minY + NODE_SIZE.height + 220, 480);
    const viewport = els.viewport.getBoundingClientRect();
    const scale = clamp(Math.min(viewport.width / width, viewport.height / height), 0.38, 1.05);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    tree.view.scale = scale;
    tree.view.x = viewport.width / 2 - centerX * scale;
    tree.view.y = viewport.height / 2 - centerY * scale;
    applyView();
    scheduleSave();
  }

  function saveTree(message) {
    tree.selectedId = selectedId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
    if (message) showToast(message);
    setStatus('已保存');
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    setStatus('保存中...');
    saveTimer = setTimeout(() => saveTree(), 350);
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2200);
  }

  function exportTree() {
    saveTree();
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `skill-tree-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('已导出 JSON 备份');
  }

  function importTree(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        tree = normalizeTree(JSON.parse(String(reader.result || '{}')));
        selectedId = tree.selectedId || 'root';
        render();
        saveTree('已导入技能树');
      } catch (error) {
        console.error(error);
        showToast('导入失败：JSON 格式不对');
      }
    };
    reader.readAsText(file);
  }

  function resetTree() {
    const ok = window.confirm('确定恢复交叉技能树模板吗？当前浏览器里的技能树会被覆盖。');
    if (!ok) return;
    tree = starterTree();
    selectedId = 'root';
    render();
    fitToTree();
    saveTree('已恢复交叉技能树模板');
  }

  function zoom(delta) {
    const before = tree.view.scale;
    tree.view.scale = clamp(tree.view.scale + delta, 0.38, 1.55);
    const rect = els.viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    tree.view.x = cx - ((cx - tree.view.x) / before) * tree.view.scale;
    tree.view.y = cy - ((cy - tree.view.y) / before) * tree.view.scale;
    applyView();
    scheduleSave();
  }

  function startNodeDrag(event) {
    if (event.target.closest('a')) return;
    event.preventDefault();
    const nodeEl = event.currentTarget;
    const item = getNode(nodeEl.dataset.id);
    if (!item) return;
    selectedId = item.id;
    dragNode = {
      id: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: item.x,
      nodeY: item.y,
      moved: false
    };
    nodeEl.setPointerCapture(event.pointerId);
    nodeEl.classList.add('is-dragging');
    renderForm();
  }

  function moveNode(event) {
    if (!dragNode) return;
    const item = getNode(dragNode.id);
    if (!item) return;
    const dx = (event.clientX - dragNode.startX) / tree.view.scale;
    const dy = (event.clientY - dragNode.startY) / tree.view.scale;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragNode.moved = true;
    item.x = clamp(dragNode.nodeX + dx, 120, WORLD.width - 120);
    item.y = clamp(dragNode.nodeY + dy, 90, WORLD.height - 90);
    const nodeEl = els.nodes.querySelector(`[data-id="${CSS.escape(item.id)}"]`);
    if (nodeEl) {
      nodeEl.style.left = `${item.x}px`;
      nodeEl.style.top = `${item.y}px`;
    }
    renderLinks();
  }

  function stopNodeDrag(event) {
    if (!dragNode) return;
    const moved = dragNode.moved;
    const nodeEl = els.nodes.querySelector(`[data-id="${CSS.escape(dragNode.id)}"]`);
    if (nodeEl && nodeEl.hasPointerCapture(event.pointerId)) nodeEl.releasePointerCapture(event.pointerId);
    if (nodeEl) nodeEl.classList.remove('is-dragging');
    selectedId = dragNode.id;
    dragNode = null;
    suppressClick = moved;
    render();
    scheduleSave();
  }

  function startPan(event) {
    if (event.target.closest('.skill-node')) return;
    panState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: tree.view.x,
      viewY: tree.view.y
    };
    els.viewport.setPointerCapture(event.pointerId);
    els.viewport.classList.add('is-panning');
  }

  function movePan(event) {
    if (!panState || dragNode) return;
    tree.view.x = panState.viewX + event.clientX - panState.startX;
    tree.view.y = panState.viewY + event.clientY - panState.startY;
    applyView();
  }

  function stopPan(event) {
    if (!panState) return;
    if (els.viewport.hasPointerCapture(event.pointerId)) els.viewport.releasePointerCapture(event.pointerId);
    els.viewport.classList.remove('is-panning');
    panState = null;
    scheduleSave();
  }

  ['input', 'change'].forEach((eventName) => {
    [els.title, els.subtitle, els.icon, els.state, els.perk, els.link, els.notes].forEach((input) => {
      input.addEventListener(eventName, updateSelectedFromForm);
    });
  });

  els.addChild.addEventListener('click', () => addNode(selectedId));
  els.addSibling.addEventListener('click', addSibling);
  els.delete.addEventListener('click', deleteSelected);
  els.layout.addEventListener('click', autoLayout);
  els.fit.addEventListener('click', () => {
    fitToTree();
    showToast('已居中显示');
  });
  els.zoomIn.addEventListener('click', () => zoom(0.12));
  els.zoomOut.addEventListener('click', () => zoom(-0.12));
  els.save.addEventListener('click', () => saveTree('已保存到当前浏览器'));
  els.export.addEventListener('click', exportTree);
  els.import.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', () => {
    importTree(els.importFile.files && els.importFile.files[0]);
    els.importFile.value = '';
  });
  els.cloudLoad.addEventListener('click', () => loadCloudTree());
  els.cloudSave.addEventListener('click', saveCloudTree);
  els.cloudEndpoint.addEventListener('change', rememberCloudConfig);
  els.cloudToken.addEventListener('change', rememberCloudConfig);
  els.cloudClear.addEventListener('click', () => {
    els.cloudEndpoint.value = '';
    els.cloudToken.value = '';
    localStorage.removeItem(CLOUD_ENDPOINT_KEY);
    localStorage.removeItem(CLOUD_TOKEN_KEY);
    updateCloudBadge();
    showToast('已清除当前浏览器里的云端配置');
  });
  els.reset.addEventListener('click', resetTree);

  els.viewport.addEventListener('pointerdown', startPan);
  els.viewport.addEventListener('pointermove', (event) => {
    moveNode(event);
    movePan(event);
  });
  els.viewport.addEventListener('pointerup', (event) => {
    stopNodeDrag(event);
    stopPan(event);
  });
  els.viewport.addEventListener('pointercancel', (event) => {
    stopNodeDrag(event);
    stopPan(event);
  });
  els.viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoom(event.deltaY > 0 ? -0.08 : 0.08);
  }, { passive: false });

  window.addEventListener('resize', applyView);

  initCloudControls();
  render();
  fitToTree();
  saveTree();
  if (getCloudEndpoint() && cloudConfig.autoLoad !== false) {
    loadCloudTree({ silent: true });
  }
})();
