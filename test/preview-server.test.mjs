import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { createPreviewServer } from '../scripts/preview-server.mjs';

const font = Buffer.from([79, 84, 84, 79, 0, 255, 128, 1]);
let connector;
let assets;
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
    } else {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><head></head><body>:search:<pre>:search:</pre></body></html>');
    }
  });
  assets = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/javascript' });
    response.end(`shared:${request.url}`);
  });
  preview = createPreviewServer({ connectorOrigin: await listen(connector), assetsOrigin: await listen(assets) });
  origin = await listen(preview);
});

after(async () => {
  for (const server of [preview, connector, assets]) {
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

test('preserves upstream error status', async () => {
  const response = await fetch(`${origin}/commerce/storefront/blocks/missing.js`);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'missing');
});