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
    return localFallbackUrl();
  }

  function localFallbackUrl() {
    const cell = 10;
    const gap = 3;
    const step = cell + gap;
    const left = 30;
    const top = 24;
    const width = 700;
    const height = 124;
    const rects = Array.from({ length: 371 }, (_, index) => {
      const row = index % 7;
      const col = Math.floor(index / 7);
      const raw = (index * 17 + col * 7 + row * 5) % 11;
      const level = raw < 4 ? 0 : raw < 6 ? 1 : raw < 8 ? 2 : raw < 10 ? 3 : 4;
      return `<rect x="${left + col * step}" y="${top + row * step}" width="${cell}" height="${cell}" rx="1.7" class="wood-inlay-cell wood-inlay-cell-${level}" fill="url(#woodGrain${level})" stroke="#f0bf70" stroke-opacity="0.52" stroke-width="0.5" filter="url(#inlayShadow)"><title>wood fallback level ${level}</title></rect>`;
    }).join('');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="GitHub contribution calendar unavailable">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
    .label { fill: #caa576; font-size: 10px; }
    .summary { fill: #f0c88d; font-size: 11px; font-weight: 700; }
  </style>
  ${woodTextureDefs()}
  <defs>
    <radialGradient id="localCornerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff3bd" stop-opacity="0.9"/>
      <stop offset="28%" stop-color="#ffd27a" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#c36a1e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" rx="10" fill="#1b0f08"/>
  <circle cx="${width - 26}" cy="14" r="54" fill="url(#localCornerGlow)" filter="url(#inlayShadow)" opacity="0.88"/>
  <text x="0" y="${top + 1 * step + 9}" class="label">Mon</text>
  <text x="0" y="${top + 3 * step + 9}" class="label">Wed</text>
  <text x="0" y="${top + 5 * step + 9}" class="label">Fri</text>
  ${rects}
  <text x="${left}" y="116" class="summary">@${USERNAME} GitHub contributions</text>
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
    if (/wood-inlay-cell/i.test(svg)) return svg;

    const defs = woodTextureDefs();

    return svg
      .replace(/(<svg\b[^>]*>)/i, `$1${defs}`)
      .replace(/<rect([^>]*\bx="[^"]+"[^>]*\by="[^"]+"[^>]*\bwidth="10"[^>]*\bheight="10"[^>]*)>(<title>[\s\S]*?<\/title>)<\/rect>/g, (match, attrs, title) => {
        const fillMatch = attrs.match(/\bfill="([^"]+)"/i);
        const level = contributionLevelFromFill(fillMatch && fillMatch[1]);
        const cleanedAttrs = attrs
          .replace(/\sfill="[^"]*"/i, '')
          .replace(/\srx="[^"]*"/i, '');

        return `<rect${cleanedAttrs} class="wood-inlay-cell wood-inlay-cell-${level}" rx="1.7" fill="url(#woodGrain${level})" stroke="#f0bf70" stroke-opacity="0.52" stroke-width="0.5" filter="url(#inlayShadow)">${title}</rect>`;
      });
  }

  function woodTextureDefs() {
    return `
  <defs>
    <linearGradient id="inlayLevel0" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6a4424"/>
      <stop offset="46%" stop-color="#3f2513"/>
      <stop offset="100%" stop-color="#1d1008"/>
    </linearGradient>
    <linearGradient id="inlayLevel1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ba7a36"/>
      <stop offset="46%" stop-color="#7a3f18"/>
      <stop offset="100%" stop-color="#331707"/>
    </linearGradient>
    <linearGradient id="inlayLevel2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0b95b"/>
      <stop offset="45%" stop-color="#a95717"/>
      <stop offset="100%" stop-color="#4c1f08"/>
    </linearGradient>
    <linearGradient id="inlayLevel3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffd06f"/>
      <stop offset="42%" stop-color="#c86d18"/>
      <stop offset="100%" stop-color="#642407"/>
    </linearGradient>
    <linearGradient id="inlayLevel4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe38c"/>
      <stop offset="38%" stop-color="#e49224"/>
      <stop offset="100%" stop-color="#852f07"/>
    </linearGradient>
    <pattern id="woodGrain0" patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" fill="url(#inlayLevel0)"/>
      <path d="M-1 2 C2 1,4 3,11 1 M-1 6 C3 5,5 8,11 6 M1 9 C4 7,7 10,11 8" fill="none" stroke="#a06a35" stroke-opacity="0.38" stroke-width="0.55"/>
      <path d="M2 0 C4 3,3 6,6 10" fill="none" stroke="#120804" stroke-opacity="0.28" stroke-width="0.45"/>
    </pattern>
    <pattern id="woodGrain1" patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" fill="url(#inlayLevel1)"/>
      <path d="M-1 1 C3 2,5 0,11 2 M-1 5 C2 3,6 7,11 5 M0 8 C3 9,6 7,11 9" fill="none" stroke="#f3bf72" stroke-opacity="0.5" stroke-width="0.58"/>
      <path d="M3 0 C1 4,5 6,4 10" fill="none" stroke="#351404" stroke-opacity="0.28" stroke-width="0.45"/>
    </pattern>
    <pattern id="woodGrain2" patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" fill="url(#inlayLevel2)"/>
      <path d="M-1 2 C3 0,5 4,11 2 M-1 6 C3 8,6 4,11 7 M1 9 C4 7,7 10,11 8" fill="none" stroke="#ffd27a" stroke-opacity="0.55" stroke-width="0.62"/>
      <path d="M2 0 C5 2,2 6,6 10" fill="none" stroke="#4a1703" stroke-opacity="0.3" stroke-width="0.5"/>
    </pattern>
    <pattern id="woodGrain3" patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" fill="url(#inlayLevel3)"/>
      <path d="M-1 1 C2 4,7 0,11 3 M-1 5 C4 3,5 8,11 6 M0 9 C4 6,8 10,11 8" fill="none" stroke="#ffe19a" stroke-opacity="0.62" stroke-width="0.66"/>
      <path d="M4 0 C2 3,6 5,5 10" fill="none" stroke="#641d02" stroke-opacity="0.32" stroke-width="0.52"/>
    </pattern>
    <pattern id="woodGrain4" patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" fill="url(#inlayLevel4)"/>
      <path d="M-1 2 C3 0,6 4,11 1 M-1 6 C2 8,6 4,11 7 M0 9 C5 6,7 10,11 8" fill="none" stroke="#fff0b7" stroke-opacity="0.72" stroke-width="0.7"/>
      <path d="M2 0 C6 2,3 6,7 10" fill="none" stroke="#742302" stroke-opacity="0.34" stroke-width="0.55"/>
    </pattern>
    <filter id="inlayShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="0.8" stdDeviation="0.45" flood-color="#120805" flood-opacity="0.62"/>
    </filter>
  </defs>`;
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
