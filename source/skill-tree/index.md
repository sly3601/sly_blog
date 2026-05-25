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
  <section class="skill-shell" aria-label="交叉领域技能树编辑器">
    <header class="skill-header">
      <div>
        <p class="skill-kicker">Cross-Domain Skill Board</p>
        <h1>领域交叉技能树</h1>
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
          <input id="skillTitle" type="text" maxlength="30" placeholder="比如：机器人系统集成">
        </label>

        <label class="skill-field">
          <span>描述</span>
          <input id="skillSubtitle" type="text" maxlength="52" placeholder="比如：感知、控制、部署的汇聚能力">
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
          <span>增益</span>
          <input id="skillPerk" type="text" maxlength="44" placeholder="+1 工程闭环 / 解锁系统项目">
        </label>

        <div class="skill-field">
          <span>所属领域</span>
          <div id="skillDomainChoices" class="skill-choice-list"></div>
          <div class="skill-domain-editor-head">
            <span>领域库</span>
            <button id="skillAddDomain" class="skill-button skill-button-mini" type="button" title="新增一个可勾选的领域">
              <i class="fas fa-plus"></i><span>新增领域</span>
            </button>
          </div>
          <div id="skillDomainManager" class="skill-domain-manager"></div>
        </div>

        <div class="skill-field">
          <span>前置技能</span>
          <div id="skillPrereqChoices" class="skill-choice-list skill-choice-list-tall"></div>
        </div>

        <label class="skill-field">
          <span>链接</span>
          <input id="skillLink" type="url" placeholder="可以放文章链接">
        </label>

        <label class="skill-field">
          <span>备注</span>
          <textarea id="skillNotes" rows="4" maxlength="320" placeholder="写学习路线、资源、实践项目"></textarea>
        </label>

        <div class="skill-panel-section">
          <p class="skill-panel-title">视图</p>
          <div class="skill-node-actions">
            <button id="skillLayout" class="skill-icon-button" type="button" title="自动整理自由图">
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
          <i class="fas fa-undo"></i><span>恢复交叉技能树模板</span>
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
          <span>节点可自由拖动，一个节点可勾选多个前置技能与多个领域</span>
        </div>
        <div id="skillViewport" class="skill-viewport">
          <div id="skillWorld" class="skill-world">
            <svg id="skillLinks" class="skill-links" width="3600" height="2400" viewBox="0 0 3600 2400" aria-hidden="true"></svg>
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
