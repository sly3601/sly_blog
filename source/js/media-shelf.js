(function () {
  const ROOT = '/sly_blog/';
  const TYPE_LABELS = {
    book: '书',
    music: '音乐',
    movie: '电影'
  };
  const TYPE_ICONS = {
    book: 'fas fa-book-open',
    music: 'fas fa-compact-disc',
    movie: 'fas fa-film'
  };

  const app = document.getElementById('mediaShelfApp');
  if (!app) return;

  document.body.classList.add('media-shelf-page');

  const els = {
    grid: document.getElementById('mediaShelfGrid'),
    status: document.getElementById('mediaShelfStatus'),
    tabs: Array.from(document.querySelectorAll('[data-media-filter]'))
  };

  let items = [];
  let filter = 'all';

  init();

  function init() {
    bindEvents();
    loadItems();
  }

  function bindEvents() {
    els.tabs.forEach((button) => {
      button.addEventListener('click', () => {
        filter = button.dataset.mediaFilter || 'all';
        els.tabs.forEach((tab) => tab.classList.toggle('is-active', tab === button));
        render();
      });
    });
  }

  async function loadItems() {
    setStatus('正在整理书柜...');
    try {
      const response = await fetch(`${apiBase()}/media-items`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      items = Array.isArray(data.items) ? data.items : [];
      render();
    } catch (error) {
      items = [];
      render();
      setStatus('书柜暂时没有连接上，稍后再看看。');
    }
  }

  function render() {
    const visible = filteredItems();
    els.grid.innerHTML = visible.length
      ? visible.map(renderItem).join('')
      : renderEmpty();

    if (visible.length) {
      setStatus(`${visible.length} 件收藏`);
    } else if (items.length) {
      setStatus('这个分区暂时空着。');
    } else {
      setStatus('还没有收藏，去写文章页添加第一件书影音。');
    }
  }

  function renderItem(item) {
    const type = normalizeType(item.mediaType);
    const title = escapeHtml(item.title || '未命名');
    const creator = escapeHtml(item.creator || TYPE_LABELS[type] || '收藏');
    const rating = item.rating ? `<span class="media-card-rating">${escapeHtml(item.rating)} / 10</span>` : '';
    const cover = item.cover
      ? `<img src="${escapeAttr(item.cover)}" alt="${title}" loading="lazy">`
      : `<span class="media-card-monogram">${title.slice(0, 1)}</span>`;
    const href = ROOT + String(item.pageUrl || '').replace(/^\/+/, '');

    return `
      <a class="media-window media-type-${type}" href="${escapeAttr(href)}" aria-label="查看 ${title}">
        <span class="media-window-glass"></span>
        <article class="media-object">
          <div class="media-object-cover">
            ${cover}
          </div>
          <div class="media-object-info">
            <span class="media-object-type"><i class="${TYPE_ICONS[type]}"></i>${TYPE_LABELS[type]}</span>
            <h2>${title}</h2>
            <p>${creator}</p>
            ${rating}
          </div>
        </article>
      </a>
    `;
  }

  function renderEmpty() {
    return `
      <div class="media-window media-window-empty">
        <span class="media-window-glass"></span>
        <div class="media-empty-copy">
          <i class="fas fa-feather-alt"></i>
          <span>等待第一件收藏入柜</span>
        </div>
      </div>
    `;
  }

  function filteredItems() {
    if (filter === 'all') return items;
    return items.filter((item) => normalizeType(item.mediaType) === filter);
  }

  function apiBase() {
    return (app.dataset.apiEndpoint || '').replace(/\/+$/, '');
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function normalizeType(type) {
    return ['book', 'music', 'movie'].includes(type) ? type : 'book';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})();
