/**
 * WurkUp browser service worker.
 * Cache only the static application shell and validated same-origin assets.
 * Authenticated/API responses are never cached.
 */
const CACHE_NAME = 'wurkup-shell-v4';
const CACHE_PREFIX = 'wurkup-shell-';
const SHELL_ASSETS = [
  { path: '/', contentTypes: ['text/html'] },
  { path: '/index.html', contentTypes: ['text/html'] },
  { path: '/manifest.json', contentTypes: ['application/manifest+json', 'application/json'] },
];
const ASSET_TYPES = {
  '.js': ['application/javascript', 'text/javascript', 'application/x-javascript'],
  '.mjs': ['application/javascript', 'text/javascript', 'application/x-javascript'],
  '.css': ['text/css'],
  '.woff2': ['font/woff2', 'application/font-woff'],
};

function mediaType(response) {
  return (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
}

function hasExpectedType(response, expectedTypes) {
  const actual = mediaType(response);
  return expectedTypes.some((expected) => actual === expected || actual.startsWith(`${expected};`));
}

function isValid(response, expectedTypes) {
  return response && response.status === 200 && hasExpectedType(response, expectedTypes);
}

function emptyAssetError(status = 404) {
  const safeStatus = status >= 400 && status <= 599 ? status : 404;
  return new Response(null, {
    status: safeStatus,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isExcludedPath(pathname) {
  return pathname === '/sw.js' ||
    pathname === '/api' || pathname.startsWith('/api/') ||
    pathname === '/auth' || pathname.startsWith('/auth/');
}

function assetTypesFor(pathname) {
  const dot = pathname.lastIndexOf('.');
  return dot < 0 ? null : ASSET_TYPES[pathname.slice(dot).toLowerCase()] || null;
}

async function cacheShellAsset(cache, asset) {
  const request = new Request(new URL(asset.path, self.location.origin), { cache: 'reload' });
  const response = await fetch(request);
  if (!isValid(response, asset.contentTypes)) {
    throw new Error(`WurkUp shell asset failed validation: ${asset.path}`);
  }
  await cache.put(request, response.clone());
}

async function networkFirstNavigation(request, cache) {
  try {
    return await fetch(request);
  } catch {
    const cachedShell = await cache.match('/');
    if (isValid(cachedShell, ['text/html'])) return cachedShell;
    return emptyAssetError(503);
  }
}

async function cacheFirstShellAsset(request, cache, expectedTypes) {
  const cached = await cache.match(request);
  if (isValid(cached, expectedTypes)) return cached;
  if (cached) await cache.delete(request);

  try {
    const response = await fetch(request);
    if (!isValid(response, expectedTypes)) {
      return emptyAssetError(response.status >= 400 ? response.status : 404);
    }
    await cache.put(request, response.clone());
    return response;
  } catch {
    return emptyAssetError(503);
  }
}

async function cacheFirstAsset(request, cache, expectedTypes) {
  const cached = await cache.match(request);
  if (isValid(cached, expectedTypes)) return cached;
  if (cached) await cache.delete(request);

  try {
    const response = await fetch(request);
    if (!isValid(response, expectedTypes)) {
      // Dev servers and SPA fallbacks may return index.html (200) for a missing
      // script/style. Never pass that HTML to a browser as executable/style data.
      return emptyAssetError(response.status >= 400 ? response.status : 404);
    }
    await cache.put(request, response.clone());
    return response;
  } catch {
    return emptyAssetError(503);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const asset of SHELL_ASSETS) await cacheShellAsset(cache, asset);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isExcludedPath(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Hash routes do not appear in the network request path. Network-first keeps
    // the current app shell fresh while the cached root supports offline reloads.
    if (request.mode === 'navigate') return networkFirstNavigation(request, cache);

    const shellAsset = SHELL_ASSETS.find((asset) => asset.path === url.pathname);
    if (shellAsset) return cacheFirstShellAsset(request, cache, shellAsset.contentTypes);

    const expectedTypes = assetTypesFor(url.pathname);
    if (expectedTypes) return cacheFirstAsset(request, cache, expectedTypes);

    return fetch(request);
  })());
});
