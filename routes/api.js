const express = require('express');
const { Readable } = require('node:stream');
const router = express.Router();

// Middleware: extract Immich credentials from headers or query params
router.use((req, res, next) => {
  const immichUrl = req.headers['x-immich-url'] || req.query.immichUrl;
  const immichKey = req.headers['x-immich-key'] || req.query.immichKey;

  if (!immichUrl || !immichKey) {
    return res.status(400).json({ error: 'Missing X-Immich-Url or X-Immich-Key' });
  }

  // Normalize: strip trailing slash
  req.immichUrl = immichUrl.replace(/\/+$/, '');
  req.immichKey = immichKey;
  next();
});

// Helper: proxy a JSON request to Immich
async function proxyJson(req, res, path) {
  try {
    const response = await fetch(`${req.immichUrl}/api${path}`, {
      headers: { 'x-api-key': req.immichKey, 'Accept': 'application/json' },
    });
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Immich API error: ${response.status} ${response.statusText}`,
      });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: `Failed to reach Immich server: ${err.message}` });
  }
}

// Helper: proxy a binary/image response from Immich
async function proxyBinary(req, res, path) {
  try {
    const response = await fetch(`${req.immichUrl}/api${path}`, {
      headers: { 'x-api-key': req.immichKey },
    });
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Immich API error: ${response.status} ${response.statusText}`,
      });
    }
    const contentType = response.headers.get('content-type');
    if (contentType) res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    Readable.fromWeb(response.body).pipe(res);
  } catch (err) {
    res.status(502).json({ error: `Failed to reach Immich server: ${err.message}` });
  }
}

// GET /api/albums - List all albums
router.get('/albums', (req, res) => {
  proxyJson(req, res, '/albums');
});

// GET /api/albums/:id - Get album with assets
router.get('/albums/:id', (req, res) => {
  proxyJson(req, res, `/albums/${req.params.id}`);
});

// GET /api/albums/:id/assets - List all assets in an album.
// Newer Immich versions no longer embed `assets` in the album response, so
// page through /search/metadata filtered by album instead.
router.get('/albums/:id/assets', async (req, res) => {
  const headers = {
    'x-api-key': req.immichKey,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  try {
    const albumRes = await fetch(`${req.immichUrl}/api/albums/${req.params.id}`, { headers });
    if (!albumRes.ok) {
      return res.status(albumRes.status).json({
        error: `Immich API error: ${albumRes.status} ${albumRes.statusText}`,
      });
    }
    const album = await albumRes.json();

    // Older Immich servers still include the assets inline
    if (Array.isArray(album.assets) && album.assets.length > 0) {
      return res.json(album.assets);
    }

    const assets = [];
    let page = 1;
    while (page) {
      const searchRes = await fetch(`${req.immichUrl}/api/search/metadata`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          albumIds: [req.params.id],
          page,
          size: 1000,
          withExif: true,
          order: album.order === 'asc' ? 'asc' : 'desc',
        }),
      });
      if (!searchRes.ok) {
        return res.status(searchRes.status).json({
          error: `Immich API error: ${searchRes.status} ${searchRes.statusText}`,
        });
      }
      const data = await searchRes.json();
      assets.push(...(data.assets?.items || []));
      page = data.assets?.nextPage ? parseInt(data.assets.nextPage, 10) : null;
    }

    res.json(assets);
  } catch (err) {
    res.status(502).json({ error: `Failed to reach Immich server: ${err.message}` });
  }
});

// GET /api/assets/:id - Get asset metadata
router.get('/assets/:id', (req, res) => {
  proxyJson(req, res, `/assets/${req.params.id}`);
});

// GET /api/assets/:id/thumbnail - Get thumbnail image
router.get('/assets/:id/thumbnail', (req, res) => {
  const size = req.query.size || 'preview';
  proxyBinary(req, res, `/assets/${req.params.id}/thumbnail?size=${size}`);
});

// GET /api/assets/:id/original - Get original image
router.get('/assets/:id/original', (req, res) => {
  proxyBinary(req, res, `/assets/${req.params.id}/original`);
});


module.exports = router;
