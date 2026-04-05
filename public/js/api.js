// Frontend API client — wraps calls to backend proxy
const ImmichAPI = (() => {
  let _url = '';
  let _key = '';

  function init(serverUrl, apiKey) {
    _url = serverUrl.replace(/\/+$/, '');
    _key = apiKey;
  }

  function headers() {
    return { 'X-Immich-Url': _url, 'X-Immich-Key': _key };
  }

  async function fetchJson(path) {
    const res = await fetch(path, { headers: headers() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  function getAlbums() {
    return fetchJson('/api/albums');
  }

  function getAlbum(id) {
    return fetchJson(`/api/albums/${id}`);
  }

  function getAssetInfo(id) {
    return fetchJson(`/api/assets/${id}`);
  }

  function thumbnailUrl(assetId) {
    return `/api/assets/${assetId}/thumbnail?immichUrl=${encodeURIComponent(_url)}&immichKey=${encodeURIComponent(_key)}`;
  }

  function originalUrl(assetId) {
    return `/api/assets/${assetId}/original?immichUrl=${encodeURIComponent(_url)}&immichKey=${encodeURIComponent(_key)}`;
  }

  return { init, getAlbums, getAlbum, getAssetInfo, thumbnailUrl, originalUrl };
})();
