---
title: 书影音
date: 2026-06-02 10:00:00
comments: false
aside: false
top_img: false
---

{% raw %}
<link rel="stylesheet" href="/sly_blog/css/media-shelf.css">

<main id="mediaShelfApp" class="media-shelf-app" data-api-endpoint="https://sly-skill-tree-api-pages.pages.dev">
  <header class="media-shelf-hero">
    <div>
      <p class="media-shelf-kicker">Library of Things I Met</p>
      <h1>书影音</h1>
    </div>
    <nav class="media-shelf-tabs" aria-label="书影音筛选">
      <button class="is-active" type="button" data-media-filter="all"><i class="fas fa-border-all"></i><span>全部</span></button>
      <button type="button" data-media-filter="book"><i class="fas fa-book"></i><span>书</span></button>
      <button type="button" data-media-filter="music"><i class="fas fa-compact-disc"></i><span>音乐</span></button>
      <button type="button" data-media-filter="movie"><i class="fas fa-film"></i><span>电影</span></button>
    </nav>
  </header>

  <section class="media-cabinet" aria-label="木质书柜">
    <div id="mediaShelfGrid" class="media-shelf-grid" aria-live="polite"></div>
  </section>

  <p id="mediaShelfStatus" class="media-shelf-status">正在整理书柜...</p>
</main>

<script defer src="/sly_blog/js/media-shelf.js?v=20260602-media-list-fix"></script>
{% endraw %}
