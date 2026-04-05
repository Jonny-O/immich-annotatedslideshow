// Slideshow engine: crossfade, preloading, timing
const Slideshow = (() => {
  let assets = [];
  let albumId = '';
  let currentIndex = -1;
  let isPlaying = false;
  let loop = true;
  let duration = 10000;
  let timer = null;
  let onSlideChange = null;
  let transitioning = false;

  // Alternate between two layers — no src copying needed
  let activeLayer = 0; // 0 = layer-a is showing, 1 = layer-b is showing

  // Preload cache: { assetId: { info } }
  const cache = {};

  const layerA = () => document.getElementById('slide-layer-a');
  const layerB = () => document.getElementById('slide-layer-b');

  function activeImg() { return activeLayer === 0 ? layerA() : layerB(); }
  function inactiveImg() { return activeLayer === 0 ? layerB() : layerA(); }

  function init(opts) {
    assets = opts.assets.filter(a => a.type === 'IMAGE');
    albumId = opts.albumId;
    loop = opts.loop;
    duration = opts.duration;
    onSlideChange = opts.onSlideChange;
    currentIndex = -1;
    activeLayer = 0;
    transitioning = false;
    Object.keys(cache).forEach(k => delete cache[k]);
  }

  function start() {
    if (assets.length === 0) return;
    isPlaying = true;
    UI.setPlayPauseIcon(true);
    goTo(0);
  }

  function stop() {
    isPlaying = false;
    clearTimeout(timer);
    UI.setPlayPauseIcon(false);
  }

  function togglePlayPause() {
    if (isPlaying) {
      stop();
    } else {
      isPlaying = true;
      UI.setPlayPauseIcon(true);
      scheduleNext();
    }
  }

  function next() {
    if (transitioning) return;
    if (currentIndex + 1 >= assets.length) {
      if (loop) {
        goTo(0);
      } else {
        stop();
      }
    } else {
      goTo(currentIndex + 1);
    }
  }

  function prev() {
    if (transitioning) return;
    if (currentIndex > 0) {
      goTo(currentIndex - 1);
    } else if (loop) {
      goTo(assets.length - 1);
    }
  }

  function setLoop(val) { loop = val; }
  function setDuration(val) { duration = val; }

  async function goTo(index) {
    clearTimeout(timer);
    currentIndex = index;
    const asset = assets[index];

    UI.updateCounter(index + 1, assets.length);
    UI.updateProgress((index + 1) / assets.length);

    // Fetch metadata (from cache or fresh)
    const data = await ensureCached(asset.id);

    // Determine orientation
    const orientation = getOrientation(data.info, asset);
    UI.setOrientation(orientation);

    // Render description
    const description = (data.info && data.info.exifInfo && data.info.exifInfo.description)
      || (asset.exifInfo && asset.exifInfo.description)
      || '';
    UI.renderDescription(description);

    // Crossfade
    await crossfade(asset.id);

    // Preload upcoming images
    preloadAhead();

    // Notify callback
    if (onSlideChange) onSlideChange(index, asset);

    // Schedule next
    if (isPlaying) scheduleNext();
  }

  function scheduleNext() {
    clearTimeout(timer);
    timer = setTimeout(() => next(), duration);
  }

  async function crossfade(assetId) {
    const url = ImmichAPI.thumbnailUrl(assetId);
    const current = activeImg();
    const incoming = inactiveImg();

    // First slide — just show it directly, no transition needed
    if (currentIndex === 0 && !current.src) {
      return new Promise((resolve) => {
        current.src = url;
        current.classList.add('active');
        incoming.classList.remove('active');
        if (current.complete && current.naturalWidth) {
          resolve();
        } else {
          current.onload = () => resolve();
        }
      });
    }

    // Load the next image into the inactive (hidden) layer
    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        transitioning = false;
        resolve();
      };

      const doTransition = () => {
        transitioning = true;

        // Ensure the incoming image is painted at opacity 0 before
        // toggling classes. Without this, the browser batches the src
        // change and class change into one paint — skipping the
        // transition entirely (no intermediate opacity 0 frame).
        // Double-rAF guarantees a
        // frame is painted in between.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            incoming.classList.add('active');
            current.classList.remove('active');

            // Flip which layer is "active" for next time
            activeLayer = activeLayer === 0 ? 1 : 0;

            incoming.addEventListener('transitionend', done, { once: true });

            // Safety fallback in case transitionend doesn't fire
            setTimeout(done, 1600);
          });
        });
      };

      incoming.src = url;
      if (incoming.complete && incoming.naturalWidth) {
        doTransition();
      } else {
        incoming.onload = doTransition;
      }
    });
  }

  async function ensureCached(assetId) {
    if (cache[assetId]) return cache[assetId];

    const info = await ImmichAPI.getAssetInfo(assetId).catch(() => null);
    cache[assetId] = { info };
    return cache[assetId];
  }

  function preloadAhead() {
    for (let i = 1; i <= 3; i++) {
      const idx = currentIndex + i;
      if (idx >= assets.length && !loop) break;
      const asset = assets[idx % assets.length];
      // Preload image into browser cache
      const img = new Image();
      img.src = ImmichAPI.thumbnailUrl(asset.id);
      // Preload metadata
      ensureCached(asset.id);
    }
  }

  function getOrientation(info, asset) {
    let w = 0, h = 0;
    if (info && info.exifInfo) {
      w = info.exifInfo.exifImageWidth || 0;
      h = info.exifInfo.exifImageHeight || 0;
    }
    if ((!w || !h) && asset) {
      w = asset.originalWidth || 0;
      h = asset.originalHeight || 0;
    }
    if (!w || !h) {
      const img = activeImg();
      if (img && img.naturalWidth) {
        w = img.naturalWidth;
        h = img.naturalHeight;
      }
    }
    return (w >= h) ? 'landscape' : 'portrait';
  }

  function destroy() {
    stop();
    assets = [];
    currentIndex = -1;
    activeLayer = 0;
    transitioning = false;
    Object.keys(cache).forEach(k => delete cache[k]);
  }

  return {
    init, start, stop, next, prev, togglePlayPause,
    setLoop, setDuration, destroy,
    getIndex: () => currentIndex,
    getTotal: () => assets.length,
    getIsPlaying: () => isPlaying,
  };
})();
