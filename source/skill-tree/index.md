---
title: 技能树
date: 2026-05-25 21:30:00
comments: false
aside: false
top_img: false
---

{% raw %}
<link rel="stylesheet" href="/sly_blog/css/skill-tree.css">

<div id="skill-tree-app" class="skill-app" data-cloud-endpoint="https://sly-skill-tree-api-pages.pages.dev" data-cloud-autoload="true">
  <section class="skill-shell" aria-label="缺氧式技能树编辑器">
    <header class="skill-header">
      <div>
        <p class="skill-kicker">Colony Skill Board</p>
        <h1>缺氧式技能树</h1>
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
            <button id="skillAddChild" class="skill-icon-button" type="button" title="添加后置技能">
              <i class="fas fa-plus"></i>
            </button>
            <button id="skillAddSibling" class="skill-icon-button" type="button" title="添加同列技能">
              <i class="fas fa-code-branch"></i>
            </button>
            <button id="skillDelete" class="skill-icon-button skill-danger" type="button" title="删除当前技能">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <label class="skill-field">
          <span>名称</span>
          <input id="skillTitle" type="text" maxlength="28" placeholder="比如：外骨骼操控">
        </label>

        <label class="skill-field">
          <span>描述</span>
          <input id="skillSubtitle" type="text" maxlength="48" placeholder="比如：运动规划、控制、仿真">
        </label>

        <div class="skill-field-row">
          <label class="skill-field">
            <span>图标</span>
            <input id="skillIcon" type="text" maxlength="2" placeholder="⚙">
          </label>
          <label class="skill-field">
            <span>状态</span>
            <select id="skillState">
              <option value="current">可学习</option>
              <option value="locked">锁定</option>
              <option value="done">已掌握</option>
              <option value="master">核心</option>
            </select>
          </label>
        </div>

        <div class="skill-field-row">
          <label class="skill-field">
            <span>分支</span>
            <select id="skillBranch"></select>
          </label>
          <label class="skill-field">
            <span>Tier</span>
            <input id="skillTier" type="number" min="1" max="6" step="1">
          </label>
        </div>

        <label class="skill-field">
          <span>增益</span>
          <input id="skillPerk" type="text" maxlength="42" placeholder="+1 研究效率 / 解锁某能力">
        </label>

        <label class="skill-field">
          <span>链接</span>
          <input id="skillLink" type="url" placeholder="可以放文章链接">
        </label>

        <label class="skill-field">
          <span>备注</span>
          <textarea id="skillNotes" rows="4" maxlength="300" placeholder="写学习路线、资源、实践项目"></textarea>
        </label>

        <div class="skill-panel-section">
          <p class="skill-panel-title">视图</p>
          <div class="skill-node-actions">
            <button id="skillLayout" class="skill-icon-button" type="button" title="自动整理缺氧式网格">
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
          <i class="fas fa-undo"></i><span>恢复缺氧式模板</span>
        </button>

        <div class="skill-cloud-card">
          <div class="skill-panel-section">
            <p class="skill-panel-title">云端</p>
            <span id="skillCloudBadge" class="skill-cloud-badge">未配置</span>
          </div>
          <label class="skill-field">
            <span>接口地址</span>
            <input id="skillCloudEndpoint" type="url" placeholder="Cloudflare Pages API">
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
          <span>拖动画布移动，点击技能卡编辑，添加按钮会自动生成依赖</span>
        </div>
        <div id="skillViewport" class="skill-viewport">
          <div id="skillWorld" class="skill-world">
            <svg id="skillLinks" class="skill-links" aria-hidden="true"></svg>
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
