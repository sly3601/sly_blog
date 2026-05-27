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

  function fallbackChartUrl() {
    return `https://ghchart.rshah.org/${PINK}/${USERNAME}`;
  }

  function localFallbackUrl() {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="124" viewBox="0 0 700 124" role="img" aria-label="GitHub contribution calendar unavailable">
  <rect width="100%" height="100%" rx="10" fill="#fffafb"/>
  <text x="24" y="56" fill="#8f5570" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="14" font-weight="700">暂时没有读到 @${USERNAME} 的 GitHub 贡献图</text>
  <text x="24" y="80" fill="#9b7284" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12">刷新后会自动重试。</text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function guardImageLoading(image, card) {
    let stage = 0;
    let timer = window.setTimeout(useFallback, 4500);

    function resetTimer() {
      window.clearTimeout(timer);
      timer = window.setTimeout(useFallback, 4500);
    }

    function useFallback() {
      card.classList.add('is-fallback');
      if (stage === 0) {
        stage = 1;
        image.src = fallbackChartUrl();
        resetTimer();
        return;
      }

      stage = 2;
      window.clearTimeout(timer);
      image.src = localFallbackUrl();
    }

    image.addEventListener('load', () => window.clearTimeout(timer));
    image.addEventListener('error', useFallback);
  }

  function createCard() {
    const card = document.createElement('section');
    card.id = 'github-contrib-card';
    card.className = 'github-contrib-card recent-post-item';
    card.innerHTML = `
      <div class="github-contrib-head">
        <div>
          <p class="github-contrib-kicker">GitHub</p>
          <h2>肝度图</h2>
        </div>
        <a class="github-contrib-link" href="https://github.com/${USERNAME}" target="_blank" rel="noopener">
          <i class="fab fa-github"></i><span>@${USERNAME}</span>
        </a>
      </div>
      <div class="github-contrib-chart" role="img" aria-label="${USERNAME} 的 GitHub 肝度图">
        <img src="${chartUrl()}" alt="${USERNAME} 的 GitHub 肝度图" loading="lazy">
      </div>
    `;

    const image = card.querySelector('img');
    guardImageLoading(image, card);
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
