const assetCache = new Map();

function matchAsset(urlStr, map) {
  let cleanPath = urlStr;
  try {
    const u = new URL(urlStr, document.baseURI);
    cleanPath = u.pathname;
  } catch {}
  const isMap = map instanceof Map;
  if (isMap ? map.has(cleanPath) : (cleanPath in map)) return cleanPath;
  const keys = isMap ? map.keys() : Object.keys(map);
  for (const k of keys) {
    if (cleanPath.endsWith(k) || urlStr.includes(k) || k.endsWith(cleanPath)) {
      return k;
    }
  }
  return null;
}

const _origFetch = window.fetch;
window.fetch = async function(input, init) {
  const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : (input && input.href ? input.href : ''));

  const matchedImg = matchAsset(urlStr, window._carSoccerImageBlobs);
  if (matchedImg) {
    const blob = window._carSoccerImageBlobs.get(matchedImg);
    return new Response(blob, {
      status: 200,
      headers: { 'Content-Type': blob.type || 'image/png' }
    });
  }

  const matchedGz = matchAsset(urlStr, window.GZ_ASSETS_MAP);
  if (matchedGz) {
    if (assetCache.has(matchedGz)) {
      const cached = assetCache.get(matchedGz);
      return new Response(cached.data.slice(0), {
        status: 200,
        headers: { 'Content-Type': cached.mime }
      });
    }

    const entry = window.GZ_ASSETS_MAP[matchedGz];
    const binStr = atob(entry.data);
    const len = binStr.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = binStr.charCodeAt(i);

    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(u8);
    writer.close();

    const decompressedResponse = new Response(ds.readable);
    const arrayBuffer = await decompressedResponse.arrayBuffer();
    assetCache.set(matchedGz, { mime: entry.mime, data: arrayBuffer });

    return new Response(arrayBuffer.slice(0), {
      status: 200,
      headers: { 'Content-Type': entry.mime }
    });
  }

  if (urlStr.includes('/api/multiplayer/')) {
    return new Response(JSON.stringify({ error: "Offline standalone mode" }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (urlStr.includes('/api/sponsors')) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (_origFetch) {
    return _origFetch(input, init);
  }
  return new Response("Not found", { status: 404 });
};
