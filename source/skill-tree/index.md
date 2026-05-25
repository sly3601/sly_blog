---
title: 技能树
date: 2026-05-25 21:30:00
comments: false
aside: false
top_img: false
---

{% raw %}
<link rel="stylesheet" href="/sly_blog/css/skill-tree.css">

<div id="skill-tree-app" class="skill-app" data-cloud-endpoint="" data-cloud-autoload="true">
  <section class="skill-shell" aria-label="技能树编辑器">
    <header class="skill-header">
      <div>
        <p class="skill-kicker">Codex Arcane Board</p>
        <h1>中世纪技能树</h1>
      </div>
      <div class="skill-actions" aria-label="技能树操作">
        <button id="skillSave" class="skill-button skill-button-primary" type="button" title="保存到当前浏览器">
          <i class="fas fa-save"></i><span>保存</span>
        </button>
        <button id="skillExport" class="skill-button" type="button" title="导出 JSON 备份">
          <i class="fas fa-file-export"></i><span>导出</span>
        </button>
        <button id="skillImport" class="skill-button" type="button" title="导入 JSON 备份">
          <i class="fas fa-file-import"></i><span>导入</span>
        </button>
        <button id="skillCloudLoad" class="skill-button" type="button" title="从云端读取最新技能树">
          <i class="fas fa-cloud-download-alt"></i><span>云端读取</span>
        </button>
        <button id="skillCloudSave" class="skill-button skill-button-cloud" type="button" title="保存到云端">
          <i class="fas fa-cloud-upload-alt"></i><span>云端保存</span>
        </button>
        <input id="skillImportFile" type="file" accept="application/json,.json" hidden>
      </div>
    </header>

    <div class="skill-board">
      <aside class="skill-panel" aria-label="节点编辑面板">
        <div class="skill-panel-section">
          <p class="skill-panel-title">节点</p>
          <div class="skill-node-actions">
            <button id="skillAddChild" class="skill-icon-button" type="button" title="添加子节点">
              <i class="fas fa-plus"></i>
            </button>
            <button id="skillAddSibling" class="skill-icon-button" type="button" title="添加同级节点">
              <i class="fas fa-code-branch"></i>
            </button>
            <button id="skillDelete" class="skill-icon-button skill-danger" type="button" title="删除当前节点">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <label class="skill-field">
          <span>名称</span>
          <input id="skillTitle" type="text" maxlength="28" placeholder="比如：机器人感知">
        </label>

        <label class="skill-field">
          <span>副标题</span>
          <input id="skillSubtitle" type="text" maxlength="42" placeholder="比如：视觉、点云、多模态">
        </label>

        <div class="skill-field-row">
          <label class="skill-field">
            <span>图标</span>
            <input id="skillIcon" type="text" maxlength="2" placeholder="✦">
          </label>
          <label class="skill-field">
            <span>状态</span>
            <select id="skillState">
              <option value="current">修炼中</option>
              <option value="locked">未解锁</option>
              <option value="done">已掌握</option>
              <option value="master">宗师</option>
            </select>
          </label>
        </div>

        <label class="skill-field">
          <span>链接</span>
          <input id="skillLink" type="url" placeholder="可以放文章链接">
        </label>

        <label class="skill-field">
          <span>备注</span>
          <textarea id="skillNotes" rows="5" maxlength="280" placeholder="写一点学习路线、资源、心得"></textarea>
        </label>

        <div class="skill-panel-section">
          <p class="skill-panel-title">视图</p>
          <div class="skill-node-actions">
            <button id="skillLayout" class="skill-icon-button" type="button" title="自动整理树结构">
              <i class="fas fa-magic"></i>
            </button>
            <button id="skillFit" class="skill-icon-button" type="button" title="居中显示">
              <i class="fas fa-compress-arrows-alt"></i>
            </button>
            <button id="skillZoomOut" class="skill-icon-button" type="button" title="缩小">
              <i class="fas fa-search-minus"></i>
            </button>
            <button id="skillZoomIn" class="skill-icon-button" type="button" title="放大">
              <i class="fas fa-search-plus"></i>
            </button>
          </div>
        </div>

        <button id="skillReset" class="skill-button skill-button-wide" type="button">
          <i class="fas fa-undo"></i><span>恢复初始模板</span>
        </button>

        <div class="skill-cloud-card">
          <div class="skill-panel-section">
            <p class="skill-panel-title">云端</p>
            <span id="skillCloudBadge" class="skill-cloud-badge">未配置</span>
          </div>
          <label class="skill-field">
            <span>接口地址</span>
            <input id="skillCloudEndpoint" type="url" placeholder="部署 Worker 后填这里">
          </label>
          <label class="skill-field">
            <span>管理员密钥</span>
            <input id="skillCloudToken" type="password" autocomplete="off" placeholder="只保存在你的浏览器">
          </label>
          <button id="skillCloudClear" class="skill-button skill-button-wide" type="button">
            <i class="fas fa-key"></i><span>清除云端配置</span>
          </button>
        </div>
      </aside>

      <main class="skill-canvas" aria-label="技能树画布">
        <div class="skill-canvas-toolbar">
          <span id="skillStatus">已自动保存</span>
          <span>拖动画布移动，拖动节点调整位置</span>
        </div>
        <div id="skillViewport" class="skill-viewport">
          <div id="skillWorld" class="skill-world">
            <svg id="skillLinks" class="skill-links" width="3200" height="2200" viewBox="0 0 3200 2200" aria-hidden="true"></svg>
            <div id="skillNodes" class="skill-nodes"></div>
          </div>
        </div>
      </main>
    </div>
  </section>
  <div id="skillToast" class="skill-toast" role="status" aria-live="polite"></div>
</div>

<script defer src="/sly_blog/js/skill-tree.js"></script>
{% endraw %}
