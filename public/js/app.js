// Main app controller
(function () {
  // Connect screen
  const connectForm = document.getElementById('connect-form');
  const connectBtn = document.getElementById('connect-btn');
  const serverUrlInput = document.getElementById('server-url');
  const apiKeyInput = document.getElementById('api-key');
  const saveCredentials = document.getElementById('save-credentials');

  // Album screen
  const backToConnectBtn = document.getElementById('back-to-connect');
  const durationSelect = document.getElementById('slide-duration');
  const loopToggle = document.getElementById('loop-toggle');

  // Slideshow screen
  const slideshowScreen = document.getElementById('slideshow-screen');
  const slideshowControls = document.getElementById('slideshow-controls');
  const btnBackAlbums = document.getElementById('btn-back-albums');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnPlayPause = document.getElementById('btn-play-pause');

  // --- Credential persistence ---
  const STORAGE_KEY = 'immich-slideshow-credentials';

  function loadCredentials() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { url, key } = JSON.parse(saved);
        if (url) serverUrlInput.value = url;
        if (key) apiKeyInput.value = key;
        saveCredentials.checked = true;
      }
    } catch (_) {}
  }

  function persistCredentials() {
    if (saveCredentials.checked) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        url: serverUrlInput.value,
        key: apiKeyInput.value,
      }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  loadCredentials();

  // --- Auto-hide controls ---
  let hideTimer = null;
  const HIDE_DELAY = 3000;

  function showControls() {
    slideshowControls.classList.remove('controls-hidden');
    slideshowControls.classList.add('controls-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideControls, HIDE_DELAY);
  }

  function hideControls() {
    if (!slideshowScreen.classList.contains('active')) return;
    slideshowControls.classList.remove('controls-visible');
    slideshowControls.classList.add('controls-hidden');
  }

  slideshowScreen.addEventListener('mousemove', showControls);
  slideshowScreen.addEventListener('mousedown', showControls);
  slideshowScreen.addEventListener('touchstart', showControls);

  // --- Connect form submit ---
  connectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.hideError('connect-error');
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    try {
      ImmichAPI.init(serverUrlInput.value, apiKeyInput.value);
      const albums = await ImmichAPI.getAlbums();

      persistCredentials();
      UI.renderAlbumGrid(albums, onAlbumSelect);
      UI.showScreen('album-screen');
    } catch (err) {
      UI.showError('connect-error', err.message);
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
    }
  });

  // Clear saved credentials when unchecked
  saveCredentials.addEventListener('change', () => {
    if (!saveCredentials.checked) {
      localStorage.removeItem(STORAGE_KEY);
    }
  });

  // Back to connect
  backToConnectBtn.addEventListener('click', () => {
    clearTimeout(hideTimer);
    UI.showScreen('connect-screen');
  });

  // Album selected
  async function onAlbumSelect(album) {
    UI.showScreen('slideshow-screen');
    showControls();

    try {
      const albumDetail = await ImmichAPI.getAlbum(album.id);
      const assets = albumDetail.assets || [];

      if (assets.length === 0) {
        alert('This album has no photos.');
        UI.showScreen('album-screen');
        return;
      }

      Slideshow.init({
        assets,
        albumId: album.id,
        loop: loopToggle.checked,
        duration: parseInt(durationSelect.value, 10),
      });
      Slideshow.start();
    } catch (err) {
      alert('Failed to load album: ' + err.message);
      UI.showScreen('album-screen');
    }
  }

  // Slideshow controls
  btnBackAlbums.addEventListener('click', () => {
    Slideshow.destroy();
    clearTimeout(hideTimer);
    document.getElementById('slide-layer-a').src = '';
    document.getElementById('slide-layer-b').src = '';
    document.getElementById('slide-layer-a').classList.remove('active');
    document.getElementById('slide-layer-b').classList.remove('active');
    UI.showScreen('album-screen');
  });

  btnPrev.addEventListener('click', () => Slideshow.prev());
  btnNext.addEventListener('click', () => Slideshow.next());
  btnPlayPause.addEventListener('click', () => Slideshow.togglePlayPause());

  // Settings changes apply live
  durationSelect.addEventListener('change', () => {
    Slideshow.setDuration(parseInt(durationSelect.value, 10));
  });
  loopToggle.addEventListener('change', () => {
    Slideshow.setLoop(loopToggle.checked);
  });

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (!slideshowScreen.classList.contains('active')) return;

    showControls();

    switch (e.key) {
      case 'ArrowRight': Slideshow.next(); break;
      case 'ArrowLeft': Slideshow.prev(); break;
      case ' ':
        e.preventDefault();
        Slideshow.togglePlayPause();
        break;
      case 'Escape':
        btnBackAlbums.click();
        break;
    }
  });
})();
