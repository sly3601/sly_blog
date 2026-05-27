---
title: 写文章
date: 2026-05-26 18:40:00
comments: false
aside: false
top_img: false
---

{% raw %}
<link rel="stylesheet" href="https://uicdn.toast.com/editor/latest/toastui-editor.min.css">
<link rel="stylesheet" href="/sly_blog/css/post-editor.css">

<div id="post-editor-app" class="post-editor-app" data-api-endpoint="https://sly-skill-tree-api-pages.pages.dev">
  <header class="write-topbar">
    <div>
      <p class="write-kicker">Feishu-like Markdown Studio</p>
      <h1>在线写文章</h1>
    </div>
    <div class="write-actions">
      <button id="writeLocalSave" class="write-button" type="button">
        <i class="fas fa-save"></i><span>保存草稿</span>
      </button>
      <button id="writeExport" class="write-button" type="button">
        <i class="fas fa-file-export"></i><span>导出 Markdown</span>
      </button>
      <button id="writePublish" class="write-button write-button-primary" type="button">
        <i class="fab fa-github"></i><span>发布到 GitHub</span>
      </button>
    </div>
  </header>

  <main class="write-layout">
    <aside class="write-sidebar" aria-label="文章信息">
      <section class="write-panel write-existing-panel">
        <div class="write-panel-title">
          <i class="fas fa-folder-tree"></i><span>现有文章</span>
        </div>
        <label class="write-field">
          <span>从 GitHub 载入</span>
          <select id="writePostSelect">
            <option value="">先刷新文章列表</option>
          </select>
        </label>
        <div class="write-mini-actions">
          <button id="writeRefreshPosts" class="write-button" type="button">
            <i class="fas fa-rotate"></i><span>刷新</span>
          </button>
          <button id="writeLoadPost" class="write-button" type="button">
            <i class="fas fa-file-import"></i><span>载入</span>
          </button>
          <button id="writeDeletePost" class="write-button write-button-danger" type="button" disabled>
            <i class="fas fa-trash-alt"></i><span>删除</span>
          </button>
          <button id="writeNewPost" class="write-button" type="button">
            <i class="fas fa-plus"></i><span>新文章</span>
          </button>
        </div>
        <p id="writePostMeta" class="write-post-meta">未载入文章</p>
      </section>

      <section class="write-panel">
        <div class="write-panel-title">
          <i class="fas fa-feather-alt"></i><span>文章信息</span>
        </div>
        <label class="write-field">
          <span>标题</span>
          <input id="writeTitle" type="text" maxlength="80" placeholder="比如：机器人全栈学习路线">
        </label>
        <label class="write-field">
          <span>文件名</span>
          <input id="writeSlug" type="text" maxlength="90" placeholder="自动生成，可手动改">
        </label>
        <label class="write-field">
          <span>分类</span>
          <input id="writeCategory" type="text" maxlength="30" value="日记" placeholder="日记 / 实操 / 理论">
        </label>
        <label class="write-field">
          <span>标签</span>
          <input id="writeTags" type="text" maxlength="160" placeholder="用逗号分隔，比如 hexo, 机器人">
        </label>
        <label class="write-field">
          <span>封面图</span>
          <input id="writeCover" type="url" placeholder="可选，文章封面 URL">
        </label>
        <label class="write-field">
          <span>摘要</span>
          <textarea id="writeDescription" rows="4" maxlength="220" placeholder="可选，首页卡片摘要"></textarea>
        </label>
      </section>

      <section class="write-panel">
        <div class="write-panel-title">
          <i class="fas fa-key"></i><span>发布设置</span>
        </div>
        <label class="write-field">
          <span>Cloudflare 接口</span>
          <input id="writeEndpoint" type="url" placeholder="Cloudflare API">
        </label>
        <label class="write-field">
          <span>管理员密钥</span>
          <input id="writeAdminToken" type="password" autocomplete="off" placeholder="只保存在当前浏览器">
        </label>
        <label class="write-check">
          <input id="writeOverwrite" type="checkbox">
          <span>允许覆盖同名文章</span>
        </label>
        <button id="writeClearSecret" class="write-button write-button-wide" type="button">
          <i class="fas fa-eraser"></i><span>清除本地密钥</span>
        </button>
      </section>
    </aside>

    <section class="write-editor-shell" aria-label="文章编辑器">
      <div class="write-toolbar">
        <button data-insert="highlight" class="write-tool" type="button" title="插入高亮">
          <i class="fas fa-highlighter"></i><span>高亮</span>
        </button>
        <button data-insert="code" class="write-tool" type="button" title="插入代码块">
          <i class="fas fa-code"></i><span>代码块</span>
        </button>
        <button data-insert="todo" class="write-tool" type="button" title="插入待办">
          <i class="fas fa-check-square"></i><span>待办</span>
        </button>
        <button data-insert="callout" class="write-tool" type="button" title="插入提示块">
          <i class="fas fa-lightbulb"></i><span>提示</span>
        </button>
        <button id="writeImageUpload" class="write-tool" type="button" title="上传图片">
          <i class="fas fa-image"></i><span>图片</span>
        </button>
        <input id="writeImageInput" class="write-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>
        <span id="writeStatus" class="write-status">草稿已就绪</span>
      </div>
      <div id="writeEditor" class="write-editor"></div>
    </section>
  </main>

  <div id="writeToast" class="write-toast" role="status" aria-live="polite"></div>
</div>

<script defer src="https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js"></script>
<script defer src="/sly_blog/js/post-editor.js"></script>
{% endraw %}
