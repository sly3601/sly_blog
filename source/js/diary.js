(function () {
  const ROOT = '/sly_blog/';
  const API_DEFAULT = 'https://sly-skill-tree-api-pages.pages.dev';
  const ENDPOINT_KEY = 'sly_blog_post_editor_endpoint';
  const TOKEN_KEY = 'sly_blog_post_editor_admin_token';
  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

  let card;
  let currentMonth = startOfMonth(new Date());
  let selectedDate = dateKey(new Date());
  let entries = new Map();
  let editorOpen = false;
  let loading = false;

  function isHomePage() {
    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    return path === '/' || path === ROOT;
  }

  function mountDiary() {
    const oldCard = document.getElementById('daily-diary-card');
    if (!isHomePage()) {
      if (oldCard) oldCard.remove();
      return;
    }

    const recentPosts = document.getElementById('recent-posts');
    if (!recentPosts) return;

    if (oldCard) {
      card = oldCard;
      render();
      return;
    }

    card = createCard();
    const githubCard = document.getElementById('github-contrib-card');
    if (githubCard && githubCard.parentNode === recentPosts) {
      githubCard.insertAdjacentElement('afterend', card);
    } else {
      recentPosts.prepend(card);
    }

    bindEvents();
    render();
    loadMonth();
  }

  function createCard() {
    const section = document.createElement('section');
    section.id = 'daily-diary-card';
    section.className = 'daily-diary-card recent-post-item';
    section.innerHTML = `
      <div class="diary-head">
        <div>
          <p class="diary-kicker">Daily Diary</p>
          <h2>日记</h2>
        </div>
        <div class="diary-head-actions">
          <button class="diary-icon-button" type="button" data-diary-action="prev" title="上个月" aria-label="上个月">
            <i class="fas fa-chevron-left"></i>
          </button>
          <strong class="diary-month-label" data-diary-month></strong>
          <button class="diary-icon-button" type="button" data-diary-action="next" title="下个月" aria-label="下个月">
            <i class="fas fa-chevron-right"></i>
          </button>
          <button class="diary-soft-button" type="button" data-diary-action="today">
            <i class="fas fa-calendar-day"></i><span>今天</span>
          </button>
          <button class="diary-soft-button diary-write-button" type="button" data-diary-action="write">
            <i class="fas fa-pen-nib"></i><span>写日记</span>
          </button>
        </div>
      </div>

      <div class="diary-board" aria-label="每日日记月图">
        <div class="diary-weekdays">
          ${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}
        </div>
        <div class="diary-grid" data-diary-grid></div>
      </div>

      <div class="diary-detail" data-diary-detail>
        <div class="diary-detail-meta">
          <span class="diary-detail-date" data-diary-selected-date></span>
          <span class="diary-status" data-diary-status></span>
        </div>
        <div class="diary-detail-content" data-diary-content></div>
      </div>

      <form class="diary-editor" data-diary-editor hidden>
        <div class="diary-editor-config">
          <label>
            <span>接口</span>
            <input type="url" data-diary-endpoint placeholder="Cloudflare API">
          </label>
          <label>
            <span>密钥</span>
            <input type="password" data-diary-token placeholder="管理员密钥" autocomplete="off">
          </label>
        </div>
        <textarea data-diary-textarea maxlength="5000" rows="7" placeholder="今天发生了什么？"></textarea>
        <div class="diary-editor-actions">
          <button class="diary-soft-button diary-save-button" type="submit">
            <i class="fas fa-save"></i><span>保存</span>
          </button>
          <button class="diary-soft-button" type="button" data-diary-action="delete">
            <i class="fas fa-trash-alt"></i><span>删除</span>
          </button>
          <button class="diary-soft-button" type="button" data-diary-action="cancel">
            <i class="fas fa-times"></i><span>收起</span>
          </button>
        </div>
      </form>
    `;
    section.querySelector('[data-diary-endpoint]').value = localStorage.getItem(ENDPOINT_KEY) || API_DEFAULT;
    section.querySelector('[data-diary-token]').value = localStorage.getItem(TOKEN_KEY) || '';
    return section;
  }

  function bindEvents() {
    card.addEventListener('click', (event) => {
      const dayButton = event.target.closest('[data-diary-date]');
      if (dayButton) {
        selectedDate = dayButton.dataset.diaryDate;
        editorOpen = false;
        render();
        return;
      }

      const actionButton = event.target.closest('[data-diary-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.diaryAction;

      if (action === 'prev') changeMonth(-1);
      if (action === 'next') changeMonth(1);
      if (action === 'today') goToday();
      if (action === 'write') openEditor();
      if (action === 'cancel') {
        editorOpen = false;
        render();
      }
      if (action === 'delete') deleteEntry();
    });

    card.querySelector('[data-diary-editor]').addEventListener('submit', (event) => {
      event.preventDefault();
      saveEntry();
    });
  }

  function changeMonth(offset) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    selectedDate = dateKey(currentMonth);
    editorOpen = false;
    render();
    loadMonth();
  }

  function goToday() {
    const today = new Date();
    currentMonth = startOfMonth(today);
    selectedDate = dateKey(today);
    editorOpen = false;
    render();
    loadMonth();
  }

  function openEditor() {
    selectedDate = ensureSelectedDateInMonth();
    editorOpen = true;
    render();
    const textarea = card.querySelector('[data-diary-textarea]');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  async function loadMonth() {
    loading = true;
    setStatus('读取中...');
    renderGrid();

    try {
      const month = monthKey(currentMonth);
      const data = await apiRequest(`/diary?month=${encodeURIComponent(month)}`);
      entries = new Map((Array.isArray(data.entries) ? data.entries : []).map((entry) => [entry.date, entry]));
      setStatus(`${entries.size} 天`);
    } catch (error) {
      entries = new Map();
      setStatus(error.message || '读取失败');
    } finally {
      loading = false;
      render();
    }
  }

  async function saveEntry() {
    const endpoint = getEndpoint();
    const token = getToken();
    const content = card.querySelector('[data-diary-textarea]').value.trim();

    if (!endpoint) {
      setStatus('接口为空');
      return;
    }
    if (!token) {
      setStatus('需要密钥');
      return;
    }
    if (!content) {
      setStatus('内容为空');
      return;
    }

    rememberConfig();
    setBusy(true);
    setStatus('保存中...');
    try {
      const data = await apiRequest('/diary', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ date: selectedDate, content }),
        headers: { 'Content-Type': 'application/json' }
      });
      entries.set(data.entry.date, data.entry);
      editorOpen = false;
      setStatus('已保存');
      render();
    } catch (error) {
      setStatus(error.message || '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry() {
    const token = getToken();
    if (!token) {
      setStatus('需要密钥');
      return;
    }
    if (!entries.has(selectedDate)) {
      setStatus('这天还没写');
      return;
    }

    rememberConfig();
    setBusy(true);
    setStatus('删除中...');
    try {
      await apiRequest(`/diary?date=${encodeURIComponent(selectedDate)}`, {
        method: 'DELETE',
        auth: true
      });
      entries.delete(selectedDate);
      editorOpen = false;
      setStatus('已删除');
      render();
    } catch (error) {
      setStatus(error.message || '删除失败');
    } finally {
      setBusy(false);
    }
  }

  function render() {
    if (!card) return;
    card.querySelector('[data-diary-month]').textContent = `${currentMonth.getFullYear()} 年 ${currentMonth.getMonth() + 1} 月`;
    renderGrid();
    renderDetail();
    renderEditor();
  }

  function renderGrid() {
    if (!card) return;
    const grid = card.querySelector('[data-diary-grid]');
    const first = startOfMonth(currentMonth);
    const offset = (first.getDay() + 6) % 7;
    const days = daysInMonth(first);
    const cells = [];

    for (let index = 0; index < offset; index += 1) {
      cells.push('<span class="diary-day is-empty"></span>');
    }

    for (let day = 1; day <= days; day += 1) {
      const date = new Date(first.getFullYear(), first.getMonth(), day);
      const key = dateKey(date);
      const entry = entries.get(key);
      const level = entry ? intensityLevel(entry.content) : 0;
      const classes = [
        'diary-day',
        entry ? 'has-entry' : '',
        key === selectedDate ? 'is-selected' : '',
        key === dateKey(new Date()) ? 'is-today' : ''
      ].filter(Boolean).join(' ');
      const title = entry ? `${key} 有日记` : `${key} 暂无日记`;
      cells.push(`
        <button class="${classes}" type="button" data-diary-date="${key}" data-level="${level}" title="${title}" aria-label="${title}">
          <span>${day}</span>
        </button>
      `);
    }

    grid.innerHTML = cells.join('');
    grid.classList.toggle('is-loading', loading);
  }

  function renderDetail() {
    const dateEl = card.querySelector('[data-diary-selected-date]');
    const contentEl = card.querySelector('[data-diary-content]');
    const entry = entries.get(selectedDate);

    dateEl.textContent = formatDateLabel(selectedDate);
    contentEl.classList.toggle('is-empty', !entry);
    contentEl.textContent = entry ? entry.content : '这一天还没有写日记。';
  }

  function renderEditor() {
    const editor = card.querySelector('[data-diary-editor]');
    const textarea = card.querySelector('[data-diary-textarea]');
    const entry = entries.get(selectedDate);
    editor.hidden = !editorOpen;
    if (editorOpen) textarea.value = entry ? entry.content : '';
  }

  async function apiRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.auth) headers.Authorization = `Bearer ${getToken()}`;
    const response = await fetch(`${getApiBase()}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(humanizeError(data.error || `HTTP ${response.status}`));
    }
    return data;
  }

  function ensureSelectedDateInMonth() {
    const prefix = `${monthKey(currentMonth)}-`;
    return selectedDate.startsWith(prefix) ? selectedDate : dateKey(currentMonth);
  }

  function getEndpoint() {
    return card.querySelector('[data-diary-endpoint]').value.trim();
  }

  function getApiBase() {
    return (getEndpoint() || API_DEFAULT).replace(/\/+$/, '');
  }

  function getToken() {
    return card.querySelector('[data-diary-token]').value.trim();
  }

  function rememberConfig() {
    localStorage.setItem(ENDPOINT_KEY, getEndpoint());
    if (getToken()) localStorage.setItem(TOKEN_KEY, getToken());
  }

  function setStatus(text) {
    if (!card) return;
    card.querySelector('[data-diary-status]').textContent = text;
  }

  function setBusy(isBusy) {
    card.querySelectorAll('button, input, textarea').forEach((element) => {
      element.disabled = isBusy;
    });
  }

  function intensityLevel(content) {
    const length = String(content || '').trim().length;
    if (length > 420) return 4;
    if (length > 180) return 3;
    if (length > 60) return 2;
    return length > 0 ? 1 : 0;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function formatDateLabel(key) {
    const parts = key.split('-').map(Number);
    if (parts.length !== 3) return key;
    return `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日`;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function humanizeError(error) {
    const map = {
      ADMIN_TOKEN_NOT_CONFIGURED: '密钥未配置',
      UNAUTHORIZED: '密钥不对',
      KV_NOT_CONFIGURED: 'KV 未配置',
      INVALID_DATE: '日期不对',
      BODY_REQUIRED: '内容为空',
      REQUEST_TOO_LARGE: '内容太长',
      INVALID_JSON: '请求格式不对',
      NOT_FOUND: '接口待部署',
      METHOD_NOT_ALLOWED: '请求方式不对'
    };
    return map[error] || error;
  }

  document.addEventListener('DOMContentLoaded', mountDiary);
  window.addEventListener('load', mountDiary);
  document.addEventListener('pjax:complete', mountDiary);
  document.addEventListener('pjax:success', mountDiary);
})();
