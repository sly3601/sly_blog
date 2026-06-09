(function () {
  function tuneImageLoading() {
    var sidebarImages = document.querySelectorAll(
      '#aside-content img, #sidebar img, .card-recent-post img, .card-categories img'
    );

    sidebarImages.forEach(function (img) {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.fetchPriority = 'low';
    });

    var firstPostCover = document.querySelector('#recent-posts .recent-post-item .post_cover img');
    if (firstPostCover) {
      var lazySrc = firstPostCover.getAttribute('data-lazy-src');
      if (lazySrc && firstPostCover.getAttribute('src') !== lazySrc) {
        firstPostCover.setAttribute('src', lazySrc);
      }
      firstPostCover.loading = 'eager';
      firstPostCover.decoding = 'async';
      firstPostCover.fetchPriority = 'high';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tuneImageLoading, { once: true });
  } else {
    tuneImageLoading();
  }

  document.addEventListener('pjax:complete', tuneImageLoading);
})();
