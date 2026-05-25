(function () {
  const STORAGE_KEY = 'sly_blog_skill_tree_v2';
  const LEGACY_STORAGE_KEY = 'sly_blog_skill_tree_v1';
  const CLOUD_ENDPOINT_KEY = 'sly_blog_skill_tree_cloud_endpoint';
  const CLOUD_TOKEN_KEY = 'sly_blog_skill_tree_cloud_token';
  const GRID = {
    left: 214,
    top: 104,
    colWidth: 220,
    rowMinHeight: 138,
    nodeWidth: 178,
    nodeHeight: 92,
    slotGap: 44,
    rightPad: 180,
    bottomPad: 120
  };
  const stateLabels = {
    locked: '锁定',
    current: '可学习',
    done: '已掌握',
    master: '核心'
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
    branch: document.getElementById('skillBranch'),
    tier: document.getElementById('skillTier'),
    perk: document.getElementById('skillPerk'),
    link: document.getElementById('skillLink'),
    notes: document.getElementById('skillNotes')
  };

  let tree = loadTree();
  let selectedId = tree.selectedId || 'root';
  let panState = null;
  let saveTimer = null;
  let toastTimer = null;
  let latestLayout = null;

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

  function starterTree() {
    return {
      version: 2,
      layout: 'oni-grid',
      selectedId: 'root',
      view: { x: 0, y: 0, scale: 0.78 },
      branches: defaultBranches(),
      tiers: defaultTiers(),
      nodes: [
        node('root', null, '基地入门', '技能树起点', '⌂', 'master', 'core', 1, 0, '+1 学习效率'),
        node('core-ops', 'root', '殖民运维', '资源、氧气、日程', '▤', 'done', 'core', 2, 0, '+1 系统规划'),
        node('core-research', 'core-ops', '科研调度', '论文、实验、复盘', '✚', 'current', 'core', 3, 0, '+1 研究速度'),
        node('core-lab', 'core-research', '实验室自动化', '工具链与流水线', '⚗', 'locked', 'core', 4, 0, '解锁实验模板'),
        node('perception-cv', 'root', '视觉感知', '相机、检测、分割', '◉', 'done', 'perception', 2, 0, '+1 图像理解'),
        node('perception-lidar', 'perception-cv', '点云建图', '深度、雷达、融合', '◎', 'current', 'perception', 3, 0, '+1 空间理解'),
        node('perception-multi', 'perception-lidar', '多模态感知', '视觉语言与传感器', '✦', 'locked', 'perception', 4, 0, '解锁跨模态任务'),
        node('control-plan', 'root', '运动规划', '路径、轨迹、约束', '↝', 'current', 'control', 2, 0, '+1 轨迹规划'),
        node('control-sim', 'control-plan', '仿真训练', 'Isaac、Gazebo、Mujoco', '⚙', 'current', 'control', 3, 0, '+1 仿真效率'),
        node('control-real', 'control-sim', '真机闭环', '部署、调参、故障恢复', '⎈', 'locked', 'control', 4, 0, '解锁真机验证'),
        node('ai-data', 'root', '数据工程', '采集、清洗、标注', '▦', 'done', 'ai', 2, 0, '+1 数据质量'),
        node('ai-train', 'ai-data', '模型训练', '训练、评测、迭代', '◆', 'current', 'ai', 3, 0, '+1 模型能力'),
        node('ai-agent', 'ai-train', '机器人 Agent', '规划、工具、记忆', '✹', 'locked', 'ai', 4, 0, '解锁智能体链路'),
        node('deploy-web', 'root', 'Web 全栈', '前端、后端、数据库', '▣', 'done', 'deploy', 2, 0, '+1 工程闭环'),
        node('deploy-cloud', 'deploy-web', '云端服务', 'CI/CD、Worker、监控', '☁', 'current', 'deploy', 3, 0, '+1 服务稳定性'),
        node('deploy-product', 'deploy-cloud', '产品化交付', '账号、支付、后台', '◈', 'locked', 'deploy', 4, 0, '解锁产品闭环'),
        node('biz-writing', 'root', '内容输出', '博客、教程、案例', '✎', 'done', 'business', 2, 0, '+1 表达力'),
        node('biz-course', 'biz-writing', '课程体系', '知识地图与训练营', '♜', 'current', 'business', 3, 0, '+1 课程转化'),
        node('biz-consult', 'biz-course', '咨询交付', '机器人知识付费', '₿', 'locked', 'business', 4, 0, '解锁商业案例')
      ]
    };
  }

  function node(id, parent, title, subtitle, icon, state, branch, tier, slot, perk) {
    return {
      id,
      parent,
      title,
      subtitle,
      icon,
      state,
      branch,
      tier,
      slot,
      perk,
      link: '',
      notes: ''
    };
  }

  function loadTree() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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
    const branches = normalizeBranches(data.branches);
    const tiers = normalizeTiers(data.tiers);
    const branchIds = branches.map((branch) => branch.id);
    const maxTier = tiers.length;
    const legacyDepth = computeLegacyDepths(data.nodes || []);

    const nodes = data.nodes.map((rawNode, index) => {
      const id = String(rawNode.id || createId());
      const branch = branchIds.includes(rawNode.branch)
        ? rawNode.branch
        : branchIds[index % branchIds.length];
      const tier = clamp(Number(rawNode.tier || legacyDepth[id] || 1), 1, maxTier);
      return {
        id,
        parent: rawNode.parent === undefined ? null : rawNode.parent,
        title: String(rawNode.title || (index === 0 ? '基地入门' : '新技能')),
        subtitle: String(rawNode.subtitle || ''),
        icon: String(rawNode.icon || branches.find((item) => item.id === branch).icon || '◆').slice(0, 2),
        state: stateLabels[rawNode.state] ? rawNode.state : 'current',
        branch,
        tier,
        slot: Number.isFinite(Number(rawNode.slot)) ? Math.max(0, Number(rawNode.slot)) : 0,
        perk: String(rawNode.perk || ''),
        link: String(rawNode.link || ''),
        notes: String(rawNode.notes || ''),
        x: 0,
        y: 0
      };
    });

    if (!nodes.some((item) => item.id === 'root')) {
      nodes[0].id = 'root';
      nodes[0].parent = null;
      nodes[0].state = 'master';
    }

    nodes.forEach((item) => {
      if (item.id === 'root') item.parent = null;
      if (item.parent && !nodes.some((candidate) => candidate.id === item.parent)) item.parent = 'root';
      item.tier = clamp(item.tier, 1, maxTier);
    });

    const normalized = {
      version: 2,
      layout: 'oni-grid',
      selectedId: data.selectedId || 'root',
      view: {
        x: Number.isFinite(Number(data.view && data.view.x)) ? Number(data.view.x) : 0,
        y: Number.isFinite(Number(data.view && data.view.y)) ? Number(data.view.y) : 0,
        scale: Number.isFinite(Number(data.view && data.view.scale)) ? clamp(Number(data.view.scale), 0.42, 1.45) : 0.78
      },
      branches,
      tiers,
      nodes
    };
    compactSlots(normalized);
    return normalized;
  }

  function normalizeBranches(input) {
    const fallback = defaultBranches();
    if (!Array.isArray(input) || !input.length) return fallback;
    const used = new Set();
    const branches = input.map((branch, index) => {
      const fallbackBranch = fallback[index % fallback.length];
      let id = String(branch.id || fallbackBranch.id || `branch-${index + 1}`).trim();
      if (!id || used.has(id)) id = `branch-${index + 1}`;
      used.add(id);
      return {
        id,
        title: String(branch.title || fallbackBranch.title || `分支 ${index + 1}`),
        icon: String(branch.icon || fallbackBranch.icon || '◆').slice(0, 2),
        color: /^#[0-9a-f]{6}$/i.test(branch.color || '') ? branch.color : fallbackBranch.color
      };
    });
    return branches.slice(0, 10);
  }

  function normalizeTiers(input) {
    const fallback = defaultTiers();
    if (!Array.isArray(input) || !input.length) return fallback;
    return input.slice(0, 8).map((tier, index) => ({
      level: index + 1,
      title: String(tier.title || `Tier ${index + 1}`),
      morale: String(tier.morale || `+${index}`)
    }));
  }

  function computeLegacyDepths(nodes) {
    const byId = new Map(nodes.map((item) => [String(item.id), item]));
    const cache = {};
    function depth(id, seen = new Set()) {
      if (cache[id]) return cache[id];
      const item = byId.get(id);
      if (!item || !item.parent || seen.has(id)) return 1;
      seen.add(id);
      cache[id] = clamp(depth(String(item.parent), seen) + 1, 1, 6);
      return cache[id];
    }
    nodes.forEach((item) => depth(String(item.id)));
    return cache;
  }

  function compactSlots(targetTree = tree) {
    targetTree.branches.forEach((branch) => {
      for (let tier = 1; tier <= targetTree.tiers.length; tier += 1) {
        targetTree.nodes
          .filter((item) => item.branch === branch.id && item.tier === tier)
          .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0) || a.title.localeCompare(b.title))
          .forEach((item, index) => {
            item.slot = index;
          });
      }
    });
  }

  function getNode(id) {
    return tree.nodes.find((item) => item.id === id);
  }

  function getChildren(parentId) {
    return tree.nodes.filter((item) => item.parent === parentId);
  }

  function getBranch(id) {
    return tree.branches.find((item) => item.id === id) || tree.branches[0];
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
    if (!els.cloudEndpoint || !els.cloudToken) return;
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
    if (!els.cloudBadge) return;
    const endpoint = getCloudEndpoint();
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
    if (endpoint) {
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

  function buildLayout() {
    compactSlots();
    const branchHeights = {};
    tree.branches.forEach((branch) => {
      let maxSlot = 0;
      tree.nodes
        .filter((item) => item.branch === branch.id)
        .forEach((item) => {
          maxSlot = Math.max(maxSlot, Number(item.slot || 0));
        });
      branchHeights[branch.id] = Math.max(GRID.rowMinHeight, 118 + maxSlot * GRID.slotGap);
    });

    const branchTops = {};
    let y = GRID.top;
    tree.branches.forEach((branch) => {
      branchTops[branch.id] = y;
      y += branchHeights[branch.id];
    });

    const width = GRID.left + tree.tiers.length * GRID.colWidth + GRID.rightPad;
    const height = y + GRID.bottomPad;
    const layout = { width, height, branchTops, branchHeights };

    tree.nodes.forEach((item) => {
      const top = branchTops[item.branch] || GRID.top;
      item.x = GRID.left + (item.tier - 1) * GRID.colWidth + GRID.colWidth / 2;
      item.y = top + 64 + Number(item.slot || 0) * GRID.slotGap;
    });

    latestLayout = layout;
    return layout;
  }

  function render() {
    if (!getNode(selectedId)) selectedId = 'root';
    tree.selectedId = selectedId;
    renderBranchOptions();
    const layout = buildLayout();
    setWorldSize(layout);
    renderLinks();
    renderNodes(layout);
    renderForm();
    applyView();
  }

  function setWorldSize(layout) {
    els.world.style.width = `${layout.width}px`;
    els.world.style.height = `${layout.height}px`;
    els.links.setAttribute('width', layout.width);
    els.links.setAttribute('height', layout.height);
    els.links.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  }

  function renderBranchOptions() {
    const currentValue = els.branch.value;
    els.branch.innerHTML = tree.branches
      .map((branch) => `<option value="${escapeHtml(branch.id)}">${escapeHtml(branch.title)}</option>`)
      .join('');
    if (currentValue && tree.branches.some((branch) => branch.id === currentValue)) {
      els.branch.value = currentValue;
    }
  }

  function renderLinks() {
    els.links.innerHTML = tree.nodes
      .filter((item) => item.parent && getNode(item.parent))
      .map((item) => {
        const parent = getNode(item.parent);
        const color = getBranch(item.branch).color;
        const startX = parent.x + GRID.nodeWidth / 2 - 8;
        const startY = parent.y;
        const endX = item.x - GRID.nodeWidth / 2 + 8;
        const endY = item.y;
        const elbow = Math.max(54, Math.abs(endX - startX) / 2);
        const d = `M ${startX} ${startY} C ${startX + elbow} ${startY}, ${endX - elbow} ${endY}, ${endX} ${endY}`;
        return `<path class="skill-link-path-shadow" d="${d}"></path><path class="skill-link-path ${item.state}" d="${d}" style="stroke:${escapeHtml(color)}"></path>`;
      })
      .join('');
  }

  function renderNodes(layout) {
    els.nodes.innerHTML = `${renderGridChrome(layout)}${tree.nodes.map(renderNode).join('')}`;

    els.nodes.querySelectorAll('.skill-node').forEach((nodeEl) => {
      nodeEl.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link) return;
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

  function renderGridChrome(layout) {
    const tiers = tree.tiers.map((tier, index) => {
      const left = GRID.left + index * GRID.colWidth;
      return `
        <div class="skill-tier-label" style="left:${left}px;top:18px;width:${GRID.colWidth}px">
          <span>${escapeHtml(tier.title)}</span>
          <em>士气 ${escapeHtml(tier.morale)}</em>
        </div>
      `;
    }).join('');

    const cells = [];
    tree.branches.forEach((branch) => {
      const top = layout.branchTops[branch.id];
      const height = layout.branchHeights[branch.id];
      cells.push(`
        <div class="skill-branch-label" style="left:18px;top:${top + 16}px;width:${GRID.left - 34}px;height:${height - 24}px;--branch-color:${escapeHtml(branch.color)}">
          <span class="skill-branch-icon">${escapeHtml(branch.icon)}</span>
          <span>${escapeHtml(branch.title)}</span>
        </div>
      `);
      tree.tiers.forEach((tier, index) => {
        const left = GRID.left + index * GRID.colWidth;
        cells.push(`<div class="skill-grid-cell" style="left:${left}px;top:${top}px;width:${GRID.colWidth}px;height:${height}px"></div>`);
      });
    });

    return `
      <div class="skill-grid-backdrop" style="width:${layout.width}px;height:${layout.height}px"></div>
      ${tiers}
      ${cells.join('')}
    `;
  }

  function renderNode(item) {
    const branch = getBranch(item.branch);
    const url = safeUrl(item.link);
    const prereq = item.parent ? getNode(item.parent) : null;
    return `
      <div class="skill-node ${item.state} ${item.id === selectedId ? 'is-selected' : ''}" data-id="${escapeHtml(item.id)}" role="button" tabindex="0" style="left:${item.x}px;top:${item.y}px;--branch-color:${escapeHtml(branch.color)}">
        <span class="skill-node-emblem">${escapeHtml(item.icon || branch.icon || '◆')}</span>
        <span class="skill-node-body">
          <span class="skill-node-title">${escapeHtml(item.title)}</span>
          <span class="skill-node-subtitle">${escapeHtml(item.subtitle || item.notes || '点击左侧面板编辑')}</span>
          <span class="skill-node-perk">${escapeHtml(item.perk || '未设置增益')}</span>
          <span class="skill-node-meta">
            <span class="skill-node-state">${stateLabels[item.state] || '可学习'}</span>
            <span class="skill-node-prereq">${prereq ? `前置 ${escapeHtml(prereq.title)}` : '起点'}</span>
            ${url ? `<a class="skill-node-link" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="打开链接"><i class="fas fa-external-link-alt"></i></a>` : ''}
          </span>
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
    els.branch.value = item.branch;
    els.tier.value = item.tier;
    els.perk.value = item.perk;
    els.link.value = item.link;
    els.notes.value = item.notes;
    els.delete.disabled = item.id === 'root';
    els.addSibling.disabled = item.id === 'root';
  }

  function applyView() {
    tree.view.scale = clamp(tree.view.scale, 0.42, 1.45);
    els.world.style.transform = `translate(${tree.view.x}px, ${tree.view.y}px) scale(${tree.view.scale})`;
  }

  function updateSelectedFromForm() {
    const item = getNode(selectedId);
    if (!item) return;
    item.title = els.title.value.trim() || '未命名技能';
    item.subtitle = els.subtitle.value.trim();
    item.icon = (els.icon.value.trim() || getBranch(item.branch).icon || '◆').slice(0, 2);
    item.state = els.state.value;
    item.branch = els.branch.value;
    item.tier = clamp(Number(els.tier.value || 1), 1, tree.tiers.length);
    item.perk = els.perk.value.trim();
    item.link = els.link.value.trim();
    item.notes = els.notes.value.trim();
    compactSlots();
    render();
    scheduleSave();
  }

  function addNode(parentId) {
    const parent = getNode(parentId) || getNode('root');
    const branch = parent.branch || tree.branches[0].id;
    const tier = clamp(Number(parent.tier || 1) + 1, 1, tree.tiers.length);
    const item = {
      id: createId(),
      parent: parent.id,
      title: '新技能',
      subtitle: '点击左侧编辑',
      icon: getBranch(branch).icon,
      state: tier <= Number(parent.tier || 1) + 1 ? 'current' : 'locked',
      branch,
      tier,
      slot: nextSlot(branch, tier),
      perk: '+1 新能力',
      link: '',
      notes: '',
      x: 0,
      y: 0
    };
    tree.nodes.push(item);
    selectedId = item.id;
    render();
    saveTree('已添加后置技能');
  }

  function addSibling() {
    const current = getNode(selectedId);
    if (!current || current.id === 'root') return;
    const item = {
      id: createId(),
      parent: current.parent || 'root',
      title: '同列技能',
      subtitle: '点击左侧编辑',
      icon: current.icon,
      state: 'current',
      branch: current.branch,
      tier: current.tier,
      slot: nextSlot(current.branch, current.tier),
      perk: '+1 分支能力',
      link: '',
      notes: '',
      x: 0,
      y: 0
    };
    tree.nodes.push(item);
    selectedId = item.id;
    render();
    saveTree('已添加同列技能');
  }

  function nextSlot(branch, tier) {
    const slots = tree.nodes
      .filter((item) => item.branch === branch && Number(item.tier) === Number(tier))
      .map((item) => Number(item.slot || 0));
    return slots.length ? Math.max(...slots) + 1 : 0;
  }

  function deleteSelected() {
    const item = getNode(selectedId);
    if (!item || item.id === 'root') return;
    const descendants = collectDescendants(item.id);
    const total = descendants.length + 1;
    const ok = window.confirm(`确定删除「${item.title}」以及 ${total - 1} 个后置技能吗？`);
    if (!ok) return;

    const removeIds = new Set([item.id, ...descendants]);
    selectedId = item.parent || 'root';
    tree.nodes = tree.nodes.filter((candidate) => !removeIds.has(candidate.id));
    compactSlots();
    render();
    saveTree('已删除技能');
  }

  function collectDescendants(id) {
    const result = [];
    const stack = getChildren(id).map((item) => item.id);
    while (stack.length) {
      const childId = stack.pop();
      result.push(childId);
      stack.push(...getChildren(childId).map((item) => item.id));
    }
    return result;
  }

  function autoLayout() {
    compactSlots();
    render();
    fitToTree();
    saveTree('已整理为缺氧式网格');
  }

  function fitToTree() {
    const layout = latestLayout || buildLayout();
    const viewport = els.viewport.getBoundingClientRect();
    const scale = clamp(Math.min(viewport.width / layout.width, viewport.height / layout.height), 0.42, 1);
    tree.view.scale = scale;
    tree.view.x = Math.max(12, (viewport.width - layout.width * scale) / 2);
    tree.view.y = Math.max(12, (viewport.height - layout.height * scale) / 2);
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
    const ok = window.confirm('确定恢复缺氧式模板吗？当前浏览器里的技能树会被覆盖。');
    if (!ok) return;
    tree = starterTree();
    selectedId = 'root';
    render();
    fitToTree();
    saveTree('已恢复缺氧式模板');
  }

  function zoom(delta) {
    const before = tree.view.scale;
    tree.view.scale = clamp(tree.view.scale + delta, 0.42, 1.45);
    const rect = els.viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    tree.view.x = cx - ((cx - tree.view.x) / before) * tree.view.scale;
    tree.view.y = cy - ((cy - tree.view.y) / before) * tree.view.scale;
    applyView();
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
    if (!panState) return;
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
    [els.title, els.subtitle, els.icon, els.state, els.branch, els.tier, els.perk, els.link, els.notes].forEach((input) => {
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
  els.viewport.addEventListener('pointermove', movePan);
  els.viewport.addEventListener('pointerup', stopPan);
  els.viewport.addEventListener('pointercancel', stopPan);
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
