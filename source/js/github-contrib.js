(function () {
  const USERNAME = 'sly3601';
  const API_BASE = 'https://sly-skill-tree-api-pages.pages.dev/github-contributions.svg';
  const PINK = 'ffc1da';
  const ROOT = '/sly_blog/';

  function isHomePage() {
    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    return path === '/' || path === ROOT;
  }

  function chartUrl() {
    const refreshBucket = Math.floor(Date.now() / (10 * 60 * 1000));
    return `${API_BASE}?user=${USERNAME}&color=${PINK}&v=${refreshBucket}`;
  }

  function createCard() {
    const card = document.createElement('section');
    card.id = 'github-contrib-card';
    card.className = 'github-contrib-card recent-post-item';
    card.innerHTML = `
      <div class="github-contrib-head">
        <div>
          <p class="github-contrib-kicker">GitHub Sync</p>
          <h2>最近一年贡献图</h2>
        </div>
        <a class="github-contrib-link" href="https://github.com/${USERNAME}" target="_blank" rel="noopener">
          <i class="fab fa-github"></i><span>@${USERNAME}</span>
        </a>
      </div>
      <div class="github-contrib-chart" role="img" aria-label="${USERNAME} 的 GitHub 最近一年贡献图">
        <img src="${chartUrl()}" alt="${USERNAME} 的 GitHub 最近一年贡献图" loading="lazy">
      </div>
      <div class="github-contrib-foot">
        <span>淡粉色主题</span>
        <span>自动同步公开贡献</span>
      </div>
    `;

    const image = card.querySelector('img');
    image.addEventListener('error', () => {
      image.src = `https://ghchart.rshah.org/${PINK}/${USERNAME}`;
      card.classList.add('is-fallback');
    }, { once: true });
    return card;
  }

  function mountGithubContrib() {
    const oldCard = document.getElementById('github-contrib-card');
    if (!isHomePage()) {
      if (oldCard) oldCard.remove();
      return;
    }

    const recentPosts = document.getElementById('recent-posts');
    if (!recentPosts || oldCard) return;
    recentPosts.prepend(createCard());
  }

  document.addEventListener('DOMContentLoaded', mountGithubContrib);
  window.addEventListener('load', mountGithubContrib);
  document.addEventListener('pjax:complete', mountGithubContrib);
  document.addEventListener('pjax:success', mountGithubContrib);
})();
