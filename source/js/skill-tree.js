(function () {
  const STORAGE_KEY = 'sly_blog_skill_tree_v1';
  const WORLD = { width: 3200, height: 2200 };
  const NODE_SIZE = { width: 228, height: 82 };
  const stateLabels = {
    locked: '未解锁',
    current: '修炼中',
    done: '已掌握',
    master: '宗师'
  };

  const app = document.getElementById('skill-tree-app');
  if (!app) return;
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
    importFile: document.getElementById('skillImportFile'),
    reset: document.getElementById('skillReset'),
    zoomIn: document.getElementById('skillZoomIn'),
    zoomOut: document.getElementById('skillZoomOut'),
    fit: document.getElementById('skillFit'),
    title: document.getElementById('skillTitle'),
    subtitle: document.getElementById('skillSubtitle'),
    icon: document.getElementById('skillIcon'),
    state: document.getElementById('skillState'),
    link: document.getElementById('skillLink'),
    notes: document.getElementById('skillNotes')
  };

  let tree = loadTree();
  let selectedId = tree.selectedId || 'root';
  let dragNode = null;
  let panState = null;
  let saveTimer = null;
  let toastTimer = null;

  function starterTree() {
    return {
      version: 1,
      selectedId: 'root',
      view: { x: 0, y: 0, scale: 0.8 },
      nodes: [
        {
          id: 'root',
          parent: null,
          title: '全栈机器人术士',
          subtitle: '从这里展开你的知识版图',
          icon: '✦',
          state: 'master',
          link: '',
          notes: '中心节点不能删除，可以改名。',
          x: 1600,
          y: 1100
        },
        {
          id: 'node-perception',
          parent: 'root',
          title: '机器人感知',
          subtitle: '视觉、点云、多模态',
          icon: '☉',
          state: 'current',
          link: '',
          notes: '',
          x: 1240,
          y: 850
        },
        {
          id: 'node-control',
          parent: 'root',
          title: '运动控制',
          subtitle: '规划、控制、仿真',
          icon: '⚙',
          state: 'current',
          link: '',
          notes: '',
          x: 1960,
          y: 850
        },
        {
          id: 'node-ai',
          parent: 'root',
          title: 'AI 工程',
          subtitle: '模型、数据、部署',
          icon: '◆',
          state: 'done',
          link: '',
          notes: '',
          x: 1240,
          y: 1350
        },
        {
          id: 'node-business',
          parent: 'root',
          title: '知识付费',
          subtitle: '课程、咨询、案例',
          icon: '♜',
          state: 'locked',
          link: '',
          notes: '',
          x: 1960,
          y: 1350
        }
      ]
    };
  }

  function loadTree() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return starterTree();
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.nodes) || !parsed.nodes.length) {
        return starterTree();
      }
      return normalizeTree(parsed);
    } catch (error) {
      console.warn('Skill tree data is invalid, using starter tree.', error);
      return starterTree();
    }
  }

  function normalizeTree(data) {
    const nodes = data.nodes.map((node, index) => ({
      id: String(node.id || createId()),
      parent: node.parent === undefined ? null : node.parent,
      title: String(node.title || (index === 0 ? '原点' : '新技能')),
      subtitle: String(node.subtitle || ''),
      icon: String(node.icon || '✦').slice(0, 2),
      state: stateLabels[node.state] ? node.state : 'current',
      link: String(node.link || ''),
      notes: String(node.notes || ''),
      x: Number.isFinite(Number(node.x)) ? Number(node.x) : WORLD.width / 2,
      y: Number.isFinite(Number(node.y)) ? Number(node.y) : WORLD.height / 2
    }));

    if (!nodes.some((node) => node.id === 'root')) {
      nodes[0].id = 'root';
      nodes[0].parent = null;
    }

    nodes.forEach((node) => {
      if (node.id === 'root') node.parent = null;
      if (node.parent && !nodes.some((candidate) => candidate.id === node.parent)) {
        node.parent = 'root';
      }
      node.x = clamp(node.x, 120, WORLD.width - 120);
      node.y = clamp(node.y, 80, WORLD.height - 80);
    });

    return {
      version: 1,
      selectedId: data.selectedId || 'root',
      view: {
        x: Number.isFinite(Number(data.view && data.view.x)) ? Number(data.view.x) : 0,
        y: Number.isFinite(Number(data.view && data.view.y)) ? Number(data.view.y) : 0,
        scale: Number.isFinite(Number(data.view && data.view.scale)) ? clamp(Number(data.view.scale), 0.35, 1.65) : 0.8
      },
      nodes
    };
  }

  function getNode(id) {
    return tree.nodes.find((node) => node.id === id);
  }

  function getChildren(parentId) {
    return tree.nodes.filter((node) => node.parent === parentId);
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

  function render() {
    if (!getNode(selectedId)) selectedId = 'root';
    tree.selectedId = selectedId;
    renderLinks();
    renderNodes();
    renderForm();
    applyView();
  }

  function renderLinks() {
    els.links.innerHTML = tree.nodes
      .filter((node) => node.parent && getNode(node.parent))
      .map((node) => {
        const parent = getNode(node.parent);
        const midX = (parent.x + node.x) / 2;
        const d = `M ${parent.x} ${parent.y} C ${midX} ${parent.y}, ${midX} ${node.y}, ${node.x} ${node.y}`;
        return `<path class="skill-link-path-shadow" d="${d}"></path><path class="skill-link-path" d="${d}"></path>`;
      })
      .join('');
  }

  function renderNodes() {
    els.nodes.innerHTML = tree.nodes.map((node) => {
      const url = safeUrl(node.link);
      return `
        <div class="skill-node ${node.state} ${node.id === selectedId ? 'is-selected' : ''}" data-id="${escapeHtml(node.id)}" role="button" tabindex="0" style="left:${node.x}px;top:${node.y}px">
          <span class="skill-node-emblem">${escapeHtml(node.icon || '✦')}</span>
          <span class="skill-node-body">
            <span class="skill-node-title">${escapeHtml(node.title)}</span>
            <span class="skill-node-subtitle">${escapeHtml(node.subtitle || node.notes || '双击左侧面板编辑这个节点')}</span>
            <span class="skill-node-meta">
              <span class="skill-node-state">${stateLabels[node.state] || '修炼中'}</span>
              ${url ? `<a class="skill-node-link" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="打开链接"><i class="fas fa-external-link-alt"></i></a>` : ''}
            </span>
          </span>
        </div>
      `;
    }).join('');

    els.nodes.querySelectorAll('.skill-node').forEach((nodeEl) => {
      nodeEl.addEventListener('pointerdown', startNodeDrag);
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

  function renderForm() {
    const node = getNode(selectedId);
    if (!node) return;

    els.title.value = node.title;
    els.subtitle.value = node.subtitle;
    els.icon.value = node.icon;
    els.state.value = node.state;
    els.link.value = node.link;
    els.notes.value = node.notes;
    els.delete.disabled = node.id === 'root';
    els.addSibling.disabled = node.id === 'root';
  }

  function applyView() {
    tree.view.scale = clamp(tree.view.scale, 0.35, 1.65);
    els.world.style.transform = `translate(${tree.view.x}px, ${tree.view.y}px) scale(${tree.view.scale})`;
  }

  function updateSelectedFromForm() {
    const node = getNode(selectedId);
    if (!node) return;

    node.title = els.title.value.trim() || '未命名技能';
    node.subtitle = els.subtitle.value.trim();
    node.icon = (els.icon.value.trim() || '✦').slice(0, 2);
    node.state = els.state.value;
    node.link = els.link.value.trim();
    node.notes = els.notes.value.trim();
    renderLinks();
    renderNodes();
    scheduleSave();
  }

  function addNode(parentId) {
    const parent = getNode(parentId) || getNode('root');
    const siblingCount = getChildren(parent.id).length;
    const angle = (Math.PI * 2 * siblingCount) / Math.max(5, siblingCount + 1) - Math.PI / 2;
    const distance = parent.id === 'root' ? 360 : 260;
    const node = {
      id: createId(),
      parent: parent.id,
      title: '新技能',
      subtitle: '点击左侧编辑',
      icon: '✦',
      state: 'current',
      link: '',
      notes: '',
      x: clamp(parent.x + Math.cos(angle) * distance, 140, WORLD.width - 140),
      y: clamp(parent.y + Math.sin(angle) * distance, 110, WORLD.height - 110)
    };
    tree.nodes.push(node);
    selectedId = node.id;
    render();
    saveTree('已添加节点');
  }

  function addSibling() {
    const node = getNode(selectedId);
    if (!node || node.id === 'root') return;
    addNode(node.parent || 'root');
  }

  function deleteSelected() {
    const node = getNode(selectedId);
    if (!node || node.id === 'root') return;

    const descendants = collectDescendants(node.id);
    const total = descendants.length + 1;
    const ok = window.confirm(`确定删除「${node.title}」以及 ${total - 1} 个子节点吗？`);
    if (!ok) return;

    const removeIds = new Set([node.id, ...descendants]);
    selectedId = node.parent || 'root';
    tree.nodes = tree.nodes.filter((candidate) => !removeIds.has(candidate.id));
    render();
    saveTree('已删除节点');
  }

  function collectDescendants(id) {
    const result = [];
    const stack = getChildren(id).map((node) => node.id);
    while (stack.length) {
      const childId = stack.pop();
      result.push(childId);
      stack.push(...getChildren(childId).map((node) => node.id));
    }
    return result;
  }

  function autoLayout() {
    const root = getNode('root');
    if (!root) return;

    root.x = WORLD.width / 2;
    root.y = WORLD.height / 2;
    layoutChildren(root.id, -Math.PI / 2, Math.PI * 2, 390, 0);
    fitToTree();
    render();
    saveTree('已自动整理');
  }

  function layoutChildren(parentId, startAngle, sweep, radius, depth) {
    const children = getChildren(parentId);
    if (!children.length) return;

    const parent = getNode(parentId);
    const step = sweep / children.length;
    children.forEach((child, index) => {
      const angle = startAngle + step * (index + 0.5);
      const distance = radius + depth * 86;
      child.x = clamp(parent.x + Math.cos(angle) * distance, 150, WORLD.width - 150);
      child.y = clamp(parent.y + Math.sin(angle) * distance, 120, WORLD.height - 120);
      layoutChildren(child.id, angle - step * 0.42, step * 0.84, Math.max(220, radius * 0.72), depth + 1);
    });
  }

  function fitToTree() {
    const bounds = tree.nodes.reduce((acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      maxX: Math.max(acc.maxX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxY: Math.max(acc.maxY, node.y)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    const width = Math.max(bounds.maxX - bounds.minX + NODE_SIZE.width + 180, 600);
    const height = Math.max(bounds.maxY - bounds.minY + NODE_SIZE.height + 180, 420);
    const viewport = els.viewport.getBoundingClientRect();
    const scale = clamp(Math.min(viewport.width / width, viewport.height / height), 0.35, 1.2);
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
        const imported = normalizeTree(JSON.parse(String(reader.result || '{}')));
        tree = imported;
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
    const ok = window.confirm('确定恢复初始模板吗？当前浏览器里的技能树会被覆盖。');
    if (!ok) return;
    tree = starterTree();
    selectedId = 'root';
    render();
    fitToTree();
    saveTree('已恢复初始模板');
  }

  function zoom(delta) {
    const before = tree.view.scale;
    tree.view.scale = clamp(tree.view.scale + delta, 0.35, 1.65);
    const rect = els.viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    tree.view.x = cx - ((cx - tree.view.x) / before) * tree.view.scale;
    tree.view.y = cy - ((cy - tree.view.y) / before) * tree.view.scale;
    applyView();
    scheduleSave();
  }

  function startNodeDrag(event) {
    const nodeEl = event.currentTarget;
    const link = event.target.closest('a');
    if (link) return;

    event.preventDefault();
    selectedId = nodeEl.dataset.id;
    const node = getNode(selectedId);
    dragNode = {
      id: selectedId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
      moved: false
    };
    nodeEl.setPointerCapture(event.pointerId);
    nodeEl.classList.add('is-dragging');
    renderForm();
  }

  function moveNode(event) {
    if (!dragNode) return;
    const node = getNode(dragNode.id);
    if (!node) return;

    const dx = (event.clientX - dragNode.startX) / tree.view.scale;
    const dy = (event.clientY - dragNode.startY) / tree.view.scale;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragNode.moved = true;
    node.x = clamp(dragNode.nodeX + dx, 120, WORLD.width - 120);
    node.y = clamp(dragNode.nodeY + dy, 80, WORLD.height - 80);
    const nodeEl = els.nodes.querySelector(`[data-id="${CSS.escape(node.id)}"]`);
    if (nodeEl) {
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;
    }
    renderLinks();
  }

  function stopNodeDrag(event) {
    if (!dragNode) return;
    const nodeEl = els.nodes.querySelector(`[data-id="${CSS.escape(dragNode.id)}"]`);
    if (nodeEl && nodeEl.hasPointerCapture(event.pointerId)) {
      nodeEl.releasePointerCapture(event.pointerId);
      nodeEl.classList.remove('is-dragging');
    }
    selectedId = dragNode.id;
    dragNode = null;
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
    if (!panState) return;
    tree.view.x = panState.viewX + event.clientX - panState.startX;
    tree.view.y = panState.viewY + event.clientY - panState.startY;
    applyView();
  }

  function stopPan(event) {
    if (!panState) return;
    if (els.viewport.hasPointerCapture(event.pointerId)) {
      els.viewport.releasePointerCapture(event.pointerId);
    }
    els.viewport.classList.remove('is-panning');
    panState = null;
    scheduleSave();
  }

  ['input', 'change'].forEach((eventName) => {
    [els.title, els.subtitle, els.icon, els.state, els.link, els.notes].forEach((input) => {
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

  window.addEventListener('resize', () => {
    applyView();
  });

  render();
  fitToTree();
  saveTree();
})();
