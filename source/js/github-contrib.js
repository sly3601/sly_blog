(function () {
  const USERNAME = 'sly3601';
  const API_BASE = 'https://sly-skill-tree-api-pages.pages.dev/github-contributions.svg';
  const PINK = 'd83f84';
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
  <rect width="100%" height="100%" rx="10" fill="#ffffff" fill-opacity="0.18"/>
  <text x="24" y="56" fill="#8f5570" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="14" font-weight="700">暂时没有读到 @${USERNAME} 的 GitHub 贡献图</text>
  <text x="24" y="80" fill="#9b7284" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12">刷新后会自动重试。</text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function enhanceSvg(svg) {
    const polished = String(svg || '')
      .replace(/fill="#fffafb"/gi, 'fill="#ffffff" fill-opacity="0.12"')
      .replace(/\s*<text[^>]*class="summary"[^>]*>[\s\S]*?<\/text>/gi, '')
      .replace(/#f4e7ee/gi, '#5a4635')
      .replace(/#ffd2e4/gi, '#b98742')
      .replace(new RegExp(`#${PINK}`, 'gi'), '#d83f84')
      .replace(/#f574ad/gi, '#b92869')
      .replace(/#c93f80/gi, '#7f1f4e')
      .replace(/#9b7284/gi, '#b89b72')
      .replace(/#8f5570/gi, '#cfaa70');

    return woodInlayContributionCells(polished);
  }

  function woodInlayContributionCells(svg) {
    const defs = `
  <defs>
    <linearGradient id="inlayLevel0" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8a765c" stop-opacity="0.8"/>
      <stop offset="48%" stop-color="#5f4d38" stop-opacity="0.86"/>
      <stop offset="100%" stop-color="#312116" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="inlayLevel1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d5b374" stop-opacity="0.94"/>
      <stop offset="48%" stop-color="#a56a2e" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#573015" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="inlayLevel2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e3bf72" stop-opacity="0.98"/>
      <stop offset="46%" stop-color="#b46c23" stop-opacity="1"/>
      <stop offset="100%" stop-color="#63300f" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="inlayLevel3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0c660" stop-opacity="1"/>
      <stop offset="43%" stop-color="#c9791f" stop-opacity="1"/>
      <stop offset="100%" stop-color="#6d2d0b" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="inlayLevel4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffd56a" stop-opacity="1"/>
      <stop offset="40%" stop-color="#d28a26" stop-opacity="1"/>
      <stop offset="100%" stop-color="#7c3108" stop-opacity="1"/>
    </linearGradient>
    <filter id="inlayShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="0.7" stdDeviation="0.35" flood-color="#120805" flood-opacity="0.48"/>
    </filter>
  </defs>`;

    return svg
      .replace(/(<svg\b[^>]*>)/i, `$1${defs}`)
      .replace(/<rect([^>]*\bx="[^"]+"[^>]*\by="[^"]+"[^>]*\bwidth="10"[^>]*\bheight="10"[^>]*)>(<title>[\s\S]*?<\/title>)<\/rect>/g, (match, attrs, title) => {
        const fillMatch = attrs.match(/\bfill="([^"]+)"/i);
        const level = contributionLevelFromFill(fillMatch && fillMatch[1]);
        const cleanedAttrs = attrs
          .replace(/\sfill="[^"]*"/i, '')
          .replace(/\srx="[^"]*"/i, '');

        return `<rect${cleanedAttrs} class="wood-inlay-cell wood-inlay-cell-${level}" rx="1.7" fill="url(#inlayLevel${level})" stroke="#caa66b" stroke-opacity="0.34" stroke-width="0.45" filter="url(#inlayShadow)">${title}</rect>`;
      });
  }

  function contributionLevelFromFill(fill) {
    const color = String(fill || '').toLowerCase();
    if (color.includes('7f1f4e')) return 4;
    if (color.includes('b92869')) return 3;
    if (color.includes('d83f84')) return 2;
    if (color.includes('ee9bbb') || color.includes('b98742')) return 1;
    return 0;
  }

  async function enhanceChartImage(image, card, url) {
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
      if (!response.ok) return;

      const svg = await response.text();
      if (!/<svg[\s>]/i.test(svg)) return;

      const chart = image.closest('.github-contrib-chart');
      if (chart) {
        chart.innerHTML = enhanceSvg(svg);
      } else {
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enhanceSvg(svg))}`;
      }
      card.classList.add('is-enhanced');
    } catch (error) {
      // The original image URL remains usable when SVG enhancement is blocked.
    }
  }

  function guardImageLoading(image, card) {
    let stage = 0;
    let timer = window.setTimeout(useFallback, 4500);

    function resetTimer() {
      window.clearTimeout(timer);
      timer = window.setTimeout(useFallback, 4500);
    }

    function useFallback() {
      if (card.classList.contains('is-enhanced')) return;

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
    const src = chartUrl();
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
        <img src="${src}" alt="${USERNAME} 的 GitHub 肝度图" loading="lazy">
      </div>
    `;

    const image = card.querySelector('img');
    guardImageLoading(image, card);
    enhanceChartImage(image, card, src);
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
