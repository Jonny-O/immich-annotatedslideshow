// DOM rendering helpers
const UI = (() => {

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function hideError(elementId) {
    document.getElementById(elementId).classList.add('hidden');
  }

  function renderAlbumGrid(albums, onClick) {
    const grid = document.getElementById('album-grid');
    grid.innerHTML = '';

    albums.forEach(album => {
      const card = document.createElement('div');
      card.className = 'album-card';
      card.addEventListener('click', () => onClick(album));

      const thumbSrc = album.albumThumbnailAssetId
        ? ImmichAPI.thumbnailUrl(album.albumThumbnailAssetId)
        : '';

      card.innerHTML = `
        ${thumbSrc ? `<img class="album-card-thumb" src="${thumbSrc}" alt="" loading="lazy">` : '<div class="album-card-thumb"></div>'}
        <div class="album-card-info">
          <div class="album-card-name">${escapeHtml(album.albumName)}</div>
          <div class="album-card-count">${album.assetCount || 0} photos</div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderDescription(text) {
    const el = document.getElementById('description-text');
    const panel = document.getElementById('description-panel');
    if (text && text.trim()) {
      el.textContent = text;
      panel.classList.remove('hidden');
    } else {
      el.textContent = '';
      panel.classList.add('hidden');
    }
  }

  function setOrientation(orientation) {
    const vp = document.getElementById('slideshow-viewport');
    vp.classList.remove('landscape', 'portrait');
    vp.classList.add(orientation);
  }

  function updateCounter(current, total) {
    document.getElementById('slide-counter').textContent = `${current} / ${total}`;
  }

  function updateProgress(fraction) {
    document.getElementById('progress-fill').style.width = `${fraction * 100}%`;
  }

  function setPlayPauseIcon(isPlaying) {
    document.getElementById('btn-play-pause').innerHTML = isPlaying ? '&#10074;&#10074;' : '&#9654;';
    document.getElementById('btn-play-pause').title = isPlaying ? 'Pause' : 'Play';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    showScreen, showError, hideError, renderAlbumGrid, renderDescription,
    setOrientation, updateCounter, updateProgress, setPlayPauseIcon,
  };
})();
