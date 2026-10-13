import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { createPreviewServer } from '../scripts/preview-server.mjs';

const font = Buffer.from([79, 84, 84, 79, 0, 255, 128, 1]);
let connector;
let assets;
let sharedContent;
let preview;
let origin;

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

before(async () => {
  connector = createServer((request, response) => {
    if (request.url.endsWith('.otf')) {
      response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-encoding': 'gzip' });
      response.end(gzipSync(font));
    } else if (request.url.endsWith('missing.js')) {
      response.writeHead(404);
      response.end('missing');
    } else if (request.url.startsWith('/commerce/storefront/blocks/storefronthome/')) {
      const type = request.url.includes('.css') ? 'text/css' : 'text/javascript';
      response.writeHead(200, { 'content-type': type });
      response.end(`project:${request.url}`);
    } else {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><head></head><body>:search:<pre>:search:</pre></body></html>');
    }
  });
  assets = createServer((request, response) => {
    if (request.url === '/franklin_assets/local-map.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"source":"local"}');
      return;
    }
    if (request.url.startsWith('/franklin_assets/')) {
      response.writeHead(404);
      response.end('missing shared content');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/javascript' });
    response.end(`shared:${request.url}`);
  });
  sharedContent = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(`published:${request.url}`);
  });
  preview = createPreviewServer({
    connectorOrigin: await listen(connector),
    assetsOrigin: await listen(assets),
    sharedContentOrigin: await listen(sharedContent),
  });
  origin = await listen(preview);
});

after(async () => {
  for (const server of [preview, connector, assets, sharedContent]) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('injects the shared runtime and preserves icons inside code', async () => {
  const response = await fetch(`${origin}/commerce/storefront/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /src="\/hlx_statics\/scripts\/scripts.js"/);
  assert.match(html, /icon-search/);
  assert.match(html, /<pre>:search:<\/pre>/);
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.equal(response.headers.get('transfer-encoding'), null);
  assert.equal(Number(response.headers.get('content-length')), Buffer.byteLength(html));
});

test('serves the static block manifest for GET and HEAD requests', async () => {
  const url = `${origin}/commerce/storefront/blocks/blocks.json?version=1`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.deepEqual(await response.json(), {
    storefronthome: {
      js: 'storefronthome/storefronthome.js',
      css: 'storefronthome/storefronthome.css',
    },
  });
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'application/json');
  assert.equal(head.headers.get('content-length'), response.headers.get('content-length'));
  assert.equal(await head.text(), '');
});

test('preserves binary fonts and removes stale compression headers', async () => {
  const response = await fetch(`${origin}/commerce/storefront/blocks/fonts/Black.otf`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), font);
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('transfer-encoding'), null);
  assert.equal(Number(response.headers.get('content-length')), font.length);
});

test('forwards shared assets and query strings to the asset service', async () => {
  const response = await fetch(`${origin}/hlx_statics/scripts/scripts.js?version=1`);
  assert.equal(await response.text(), 'shared:/hlx_statics/scripts/scripts.js?version=1');
  assert.equal(response.headers.get('content-type'), 'text/javascript');
});

test('routes registered project block assets requested by the shared runtime', async () => {
  for (const [file, type] of [['storefronthome.js', 'text/javascript'], ['storefronthome.css', 'text/css']]) {
    const url = `${origin}/hlx_statics/blocks/storefronthome/${file}?version=1`;
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), `project:/commerce/storefront/blocks/storefronthome/${file}?version=1`);
    assert.equal(response.headers.get('content-type'), type);
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-type'), type);
    assert.equal(await head.text(), '');
  }
  const response = await fetch(`${origin}/hlx_statics/blocks/storefronthome/fonts/AdobeClean-Black.otf`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), font);
});

test('keeps unregistered blocks on the shared asset service', async () => {
  const response = await fetch(`${origin}/hlx_statics/blocks/header/header.js`);
  assert.equal(await response.text(), 'shared:/hlx_statics/blocks/header/header.js');
});

test('preserves upstream error status', async () => {
  const response = await fetch(`${origin}/commerce/storefront/blocks/missing.js`);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'missing');
});

test('uses published shared content when the local asset server is missing the search product map', async () => {
  const url = `${origin}/franklin_assets/product-index-map.json?version=1`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(await response.text(), 'published:/franklin_assets/product-index-map.json?version=1');
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'application/json');
  assert.equal(await head.text(), '');
});

test('keeps available shared content on the local asset service', async () => {
  const response = await fetch(`${origin}/franklin_assets/local-map.json`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { source: 'local' });
});
