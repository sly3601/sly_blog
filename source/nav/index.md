---
title: 私人导航
date: 2026-05-28 17:35:00
comments: false
aside: false
top_img: false
sitemap: false
indexing: false
robots: noindex,nofollow
---

{% raw %}
<link rel="stylesheet" href="/sly_blog/css/navigator.css?v=20260530-nav4">

<div id="navigator-app" class="navigator-app" data-api-endpoint="https://sly-skill-tree-api-pages.pages.dev">
  <section id="navLock" class="nav-lock-screen" aria-label="私人导航解锁">
    <div class="nav-lock-panel">
      <div class="nav-lock-mark" aria-hidden="true">
        <i class="fas fa-lock"></i>
      </div>
      <h1>私人导航</h1>
      <form id="navUnlockForm" class="nav-unlock-form">
        <label class="nav-field">
          <span>管理员密钥</span>
          <input id="navAdminToken" type="password" autocomplete="current-password" placeholder="输入通用密钥">
        </label>
        <label class="nav-field nav-endpoint-field">
          <span>Cloudflare 接口</span>
          <input id="navEndpoint" type="url" placeholder="Cloudflare API">
        </label>
        <button id="navUnlockButton" class="nav-button nav-button-primary" type="submit">
          <i class="fas fa-lock-open"></i><span>解锁</span>
        </button>
      </form>
      <p id="navLockStatus" class="nav-lock-status">等待密钥</p>
    </div>
  </section>

  <section id="navDesk" class="nav-desk" aria-label="私人网址导航">
    <header class="nav-topbar">
      <button id="navLockButton" class="nav-icon-button" type="button" title="锁定导航" aria-label="锁定导航">
        <i class="fas fa-lock"></i>
      </button>
      <div class="nav-sync-state">
        <span id="navSiteCount">0 个收藏</span>
        <span id="navSyncStatus">未同步</span>
      </div>
    </header>

    <main class="nav-home">
      <form id="navSearchForm" class="nav-search-form">
        <i class="fas fa-search" aria-hidden="true"></i>
        <input id="navSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="搜索或输入网址">
        <button id="navSearchClear" class="nav-icon-button" type="button" title="清空" aria-label="清空">
          <i class="fas fa-times"></i>
        </button>
      </form>

      <div id="navGroupTabs" class="nav-group-tabs" aria-label="分组"></div>
      <div id="navSitesGrid" class="nav-sites-grid" aria-live="polite"></div>
    </main>

    <button id="navFabAdd" class="nav-fab" type="button" title="添加网站" aria-label="添加网站">
      <i class="fas fa-plus"></i>
    </button>
  </section>

  <div id="navSiteDialog" class="nav-dialog" role="dialog" aria-modal="true" aria-labelledby="navDialogTitle" hidden>
    <div class="nav-dialog-backdrop" data-close-dialog></div>
    <form id="navSiteForm" class="nav-dialog-panel">
      <div class="nav-dialog-head">
        <h2 id="navDialogTitle">添加网站</h2>
        <button class="nav-icon-button" type="button" title="关闭" aria-label="关闭" data-close-dialog>
          <i class="fas fa-times"></i>
        </button>
      </div>

      <input id="navEditingId" type="hidden">

      <label class="nav-field">
        <span>名称</span>
        <input id="navSiteTitle" type="text" maxlength="80" required placeholder="OpenAI">
      </label>

      <label class="nav-field">
        <span>网址</span>
        <input id="navSiteUrl" type="text" required placeholder="https://openai.com">
      </label>

      <div class="nav-field-row">
        <label class="nav-field">
          <span>图标类型</span>
          <select id="navIconType">
            <option value="favicon">自动图标</option>
            <option value="image">图片 URL</option>
            <option value="emoji">文字 / Emoji</option>
            <option value="letter">首字母</option>
            <option value="color">纯色</option>
          </select>
        </label>
        <label class="nav-field nav-color-field">
          <span>颜色</span>
          <input id="navSiteColor" type="color" value="#4285f4">
        </label>
      </div>

      <label id="navIconValueField" class="nav-field">
        <span>自定义图标</span>
        <input id="navSiteIcon" type="text" maxlength="500" placeholder="图片链接或一个 Emoji">
      </label>

      <div class="nav-icon-preview-row">
        <span>预览</span>
        <div id="navIconPreview" class="nav-site-icon nav-preview-icon"></div>
      </div>

      <div class="nav-field-row">
        <label class="nav-field">
          <span>分组</span>
          <input id="navSiteGroup" type="text" maxlength="40" placeholder="工具">
        </label>
        <label class="nav-check">
          <input id="navSitePinned" type="checkbox">
          <span>置顶</span>
        </label>
      </div>

      <label class="nav-field">
        <span>备注</span>
        <input id="navSiteNote" type="text" maxlength="180" placeholder="可选">
      </label>

      <div class="nav-dialog-actions">
        <button id="navDeleteInDialog" class="nav-button nav-button-danger" type="button">
          <i class="fas fa-trash-alt"></i><span>删除</span>
        </button>
        <button class="nav-button" type="button" data-close-dialog>
          <i class="fas fa-undo"></i><span>取消</span>
        </button>
        <button class="nav-button nav-button-primary" type="submit">
          <i class="fas fa-check"></i><span>保存</span>
        </button>
      </div>
    </form>
  </div>

  <div id="navToast" class="nav-toast" role="status" aria-live="polite"></div>
</div>

<script>
  (function () {
    var meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow,noarchive';
    document.head.appendChild(meta);
  })();
</script>
<script defer src="/sly_blog/js/navigator.js?v=20260530-nav4"></script>
{% endraw %}
