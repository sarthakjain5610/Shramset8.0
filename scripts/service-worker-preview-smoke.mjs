import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 4187;
const origin = `http://127.0.0.1:${port}`;
const preview = spawn(process.execPath, [
  path.join(root, 'node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let previewLog = '';
preview.stdout.setEncoding('utf8').on('data', (chunk) => { previewLog += chunk; });
preview.stderr.setEncoding('utf8').on('data', (chunk) => { previewLog += chunk; });

async function waitForPreview() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) throw new Error(`Vite preview exited early:\n${previewLog}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return response;
    } catch { /* wait for the preview server to bind */ }
    await delay(150);
  }
  throw new Error(`Timed out waiting for Vite preview:\n${previewLog}`);
}

class MemoryCache {
  constructor() { this.entries = new Map(); }
  key(input) { return new URL(typeof input === 'string' ? input : input.url, origin).href; }
  async match(input) { return this.entries.get(this.key(input))?.clone(); }
  async put(input, response) { this.entries.set(this.key(input), response.clone()); }
  async delete(input) { return this.entries.delete(this.key(input)); }
}

class MemoryCaches {
  constructor() { this.items = new Map(); }
  async open(name) {
    if (!this.items.has(name)) this.items.set(name, new MemoryCache());
    return this.items.get(name);
  }
  async keys() { return [...this.items.keys()]; }
  async delete(name) { return this.items.delete(name); }
}

function serviceWorkerHarness() {
  const listeners = new Map();
  const cacheStorage = new MemoryCaches();
  let offline = false;
  const self = {
    location: new URL(origin),
    clients: { claim: async () => {} },
    addEventListener: (type, listener) => listeners.set(type, listener),
    skipWaiting: async () => {},
  };
  const fetchFromPreview = async (input) => {
    if (offline) throw new TypeError('simulated offline');
    const request = input instanceof Request ? input : new Request(input.url, {
      method: input.method || 'GET',
      headers: input.headers || {},
    });
    return fetch(request);
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8'), {
    self,
    caches: cacheStorage,
    fetch: fetchFromPreview,
    Request,
    Response,
    URL,
    Headers,
    console,
  }, { filename: 'public/sw.js' });

  return {
    cacheStorage,
    setOffline(value) { offline = value; },
    async dispatch(type, request) {
      let responsePromise;
      const waits = [];
      const event = {
        request,
        respondWith(promise) { responsePromise = Promise.resolve(promise); },
        waitUntil(promise) { waits.push(Promise.resolve(promise)); },
      };
      listeners.get(type)?.(event);
      if (waits.length) await Promise.all(waits);
      return responsePromise ? responsePromise : null;
    },
  };
}

function swRequest(url, { mode = 'no-cors', destination = '', headers = {} } = {}) {
  return { url, method: 'GET', mode, destination, headers: new Headers(headers) };
}

async function run() {
  await waitForPreview();

  const homeResponse = await fetch(origin);
  assert.equal(homeResponse.status, 200, 'homepage returns 200');
  assert.match(homeResponse.headers.get('content-type') || '', /text\/html/i, 'homepage has HTML MIME type');
  const html = await homeResponse.text();
  const jsPath = html.match(/<script[^>]+src="([^"]+\.js)"/i)?.[1];
  const cssPath = html.match(/<link[^>]+href="([^"]+\.css)"/i)?.[1];
  assert.ok(jsPath, 'built homepage references a JS bundle');
  assert.ok(cssPath, 'built homepage references a CSS bundle');

  const jsResponse = await fetch(new URL(jsPath, origin));
  const cssResponse = await fetch(new URL(cssPath, origin));
  assert.equal(jsResponse.status, 200, 'existing JavaScript returns 200');
  assert.match(jsResponse.headers.get('content-type') || '', /(?:application|text)\/javascript/i, 'existing JavaScript has a JavaScript MIME type');
  assert.equal(cssResponse.status, 200, 'existing CSS returns 200');
  assert.match(cssResponse.headers.get('content-type') || '', /text\/css/i, 'existing CSS has a CSS MIME type');

  const harness = serviceWorkerHarness();
  const oldCache = await harness.cacheStorage.open('wurkup-shell-v3');
  await oldCache.put(`${origin}/`, new Response('old version', { headers: { 'Content-Type': 'text/html' } }));
  const unrelatedCache = await harness.cacheStorage.open('unrelated-origin-cache');
  await unrelatedCache.put(`${origin}/assets/missing.js`, new Response('not the WurkUp cache', {
    headers: { 'Content-Type': 'application/javascript' },
  }));

  await harness.dispatch('install');
  await harness.dispatch('activate');
  const cacheNames = await harness.cacheStorage.keys();
  assert.ok(cacheNames.includes('wurkup-shell-v4'), 'v4 shell cache installed');
  assert.ok(!cacheNames.includes('wurkup-shell-v3'), 'v3 WurkUp cache removed on upgrade');
  assert.ok(cacheNames.includes('unrelated-origin-cache'), 'unrelated origin cache preserved');

  const jsFromWorker = await harness.dispatch('fetch', swRequest(new URL(jsPath, origin).href, {
    destination: 'script', headers: { accept: '*/*', 'sec-fetch-dest': 'script', 'sec-fetch-mode': 'no-cors' },
  }));
  const cssFromWorker = await harness.dispatch('fetch', swRequest(new URL(cssPath, origin).href, {
    destination: 'style', headers: { accept: 'text/css,*/*;q=0.1', 'sec-fetch-dest': 'style', 'sec-fetch-mode': 'no-cors' },
  }));
  assert.equal(jsFromWorker.status, 200, 'service worker returns existing JavaScript');
  assert.match(jsFromWorker.headers.get('content-type') || '', /(?:application|text)\/javascript/i, 'service worker preserves JavaScript MIME type');
  assert.equal(cssFromWorker.status, 200, 'service worker returns existing CSS');
  assert.match(cssFromWorker.headers.get('content-type') || '', /text\/css/i, 'service worker preserves CSS MIME type');

  const currentCache = await harness.cacheStorage.open('wurkup-shell-v4');
  assert.match((await currentCache.match(new URL(jsPath, origin).href)).headers.get('content-type') || '', /(?:application|text)\/javascript/i, 'only validated JavaScript is cached');
  assert.match((await currentCache.match(new URL(cssPath, origin).href)).headers.get('content-type') || '', /text\/css/i, 'only validated CSS is cached');
  const missingJsUrl = `${origin}/assets/missing.js`;
  const missingCssUrl = `${origin}/assets/missing.css`;
  // A malformed current-cache entry must be discarded; a matching unrelated cache entry must not be read.
  await currentCache.put(missingJsUrl, new Response('<!doctype html><title>SPA fallback</title>', {
    headers: { 'Content-Type': 'text/html' },
  }));
  for (const [url, destination, accept] of [
    [missingJsUrl, 'script', '*/*'],
    [missingCssUrl, 'style', 'text/css,*/*;q=0.1'],
  ]) {
    const missing = await harness.dispatch('fetch', swRequest(url, {
      destination,
      headers: { accept, 'sec-fetch-dest': destination, 'sec-fetch-mode': 'no-cors' },
    }));
    assert.equal(missing.status, 404, `missing ${destination} returns 404`);
    assert.equal(await missing.text(), '', `missing ${destination} has no HTML/body`);
    assert.doesNotMatch(missing.headers.get('content-type') || '', /text\/html/i, `missing ${destination} is not labelled HTML`);
  }
  assert.equal(await currentCache.match(missingJsUrl), undefined, 'HTML fallback is never cached as JavaScript');
  assert.equal(await currentCache.match(missingCssUrl), undefined, 'HTML fallback is never cached as CSS');

  for (const excludedPath of ['/sw.js', '/api/test', '/auth/callback']) {
    const intercepted = await harness.dispatch('fetch', swRequest(`${origin}${excludedPath}`));
    assert.equal(intercepted, null, `${excludedPath} bypasses the service worker`);
  }

  const hashBrowserUrl = new URL(`${origin}/#/how-it-works`);
  assert.equal(hashBrowserUrl.pathname, '/', 'hash navigation remains a root document request');
  assert.equal(hashBrowserUrl.hash, '#/how-it-works', 'client-side hash route is retained in browser URL');
  const onlineNavigation = await harness.dispatch('fetch', swRequest(`${origin}/`, { mode: 'navigate', destination: 'document' }));
  assert.equal(onlineNavigation.status, 200, 'online navigation uses the network-first shell');
  assert.match(onlineNavigation.headers.get('content-type') || '', /text\/html/i, 'navigation receives HTML');

  harness.setOffline(true);
  const offlineNavigation = await harness.dispatch('fetch', swRequest(`${origin}/`, { mode: 'navigate', destination: 'document' }));
  assert.equal(offlineNavigation.status, 200, 'offline navigation falls back to cached shell');
  assert.match(offlineNavigation.headers.get('content-type') || '', /text\/html/i, 'offline fallback remains HTML');
  assert.match(await offlineNavigation.text(), /id="root"/, 'offline fallback is the WurkUp app shell');

  console.log('PASS homepage and existing JS/CSS preview responses and MIME types');
  console.log('PASS v3→v4 cache upgrade; obsolete WurkUp cache removed, unrelated cache preserved');
  console.log('PASS missing JS/CSS return empty 404 responses, never SPA HTML');
  console.log('PASS /sw.js, /api and /auth bypass; offline navigation and hash-route shell work');
}

try {
  await run();
} finally {
  preview.kill('SIGTERM');
}
