import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const PROJECT_PATH = '/commerce/storefront';
const MANIFEST_PATH = `${PROJECT_PATH}/blocks/blocks.json`;
const MANIFEST_FILE = new URL('../static/blocks/blocks.json', import.meta.url);
const SHARED_RUNTIME_HTML = '<link rel="stylesheet" href="/hlx_statics/styles/styles.css">'
  + '<script src="/hlx_statics/scripts/scripts.js" type="module"></script>';
const UPSTREAM_HEADERS_TO_REMOVE = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'content-length', 'content-encoding',
];

/**
 * Converts authored icon tokens to spans the shared runtime can render.
 * Temporarily hides code examples so their literal tokens remain unchanged.
 */
function rewriteIcons(html) {
  const codeBlocks = [];
  let processed = html.replace(/<(code|pre)[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });
  processed = processed.replace(/(?<!(?:https?|urn)[^\s]*):(#?[a-z_-]+[a-z\d]*):/gi, (match, iconName) => {
    const name = iconName.startsWith('#') ? iconName.substring(1) : iconName;
    return `<span class="icon icon-${name}"></span>`;
  });
  return processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => codeBlocks[index]);
}

/**
 * Maps registered project blocks from shared-runtime URLs to connector paths.
 * This keeps project-owned assets out of the shared asset lookup without affecting shared blocks.
 */
async function resolveProjectBlockPath(pathname) {
  const sharedBlock = pathname.match(/^\/hlx_statics\/blocks\/([a-z0-9][a-z0-9-]*)\//);
  if (!sharedBlock) {
    return pathname;
  }

  // The shared runtime requests all blocks here. Only registered blocks belong to this project.
  const manifest = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'));
  const blockName = sharedBlock[1];
  if (!Object.hasOwn(manifest, blockName)) {
    return pathname;
  }
  return pathname.replace('/hlx_statics/', `${PROJECT_PATH}/`);
}

/**
 * Creates a proxy that serves connector content and shared AEM assets on one origin.
 * Injects the browser runtime so locally rendered Markdown becomes a working preview.
 */
export function createPreviewServer({
  connectorOrigin = 'http://127.0.0.1:3002',
  assetsOrigin = 'http://127.0.0.1:3001',
} = {}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const isHeadRequest = request.method === 'HEAD';

      // The connector serves page files, but the manifest lives in static/.
      if (url.pathname === MANIFEST_PATH) {
        const body = await readFile(MANIFEST_FILE);
        response.writeHead(200, {
          'content-type': 'application/json',
          'cache-control': 'no-cache',
          'content-length': body.length,
        });
        response.end(isHeadRequest ? undefined : body);
        return;
      }

      // Project content comes from the connector. Shared runtime assets come from AEM.
      const pathname = await resolveProjectBlockPath(url.pathname);
      const isDocumentation = pathname === PROJECT_PATH || pathname.startsWith(`${PROJECT_PATH}/`);
      const upstreamOrigin = isDocumentation ? connectorOrigin : assetsOrigin;
      const upstream = new URL(`${pathname}${url.search}`, upstreamOrigin);
      const result = await fetch(upstream, {
        method: isHeadRequest ? 'HEAD' : 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      const headers = Object.fromEntries(result.headers);

      // Connection headers cannot be forwarded. Fetch decompresses the body, and HTML edits change its length.
      for (const name of UPSTREAM_HEADERS_TO_REMOVE) {
        delete headers[name];
      }
      if (isDocumentation && !headers['cache-control']) {
        headers['cache-control'] = 'no-cache';
      }

      // Keep fonts and other binary assets as bytes; only documentation HTML needs rewriting.
      let body = Buffer.from(await result.arrayBuffer());
      if (isDocumentation && headers['content-type']?.includes('text/html')) {
        const html = rewriteIcons(body.toString('utf8'));
        body = Buffer.from(html.replace('</head>', `${SHARED_RUNTIME_HTML}</head>`));
      }
      const allowsBody = !isHeadRequest && result.status !== 204 && result.status !== 304;
      if (allowsBody) {
        headers['content-length'] = String(body.length);
      }
      response.writeHead(result.status, headers);
      response.end(isHeadRequest ? undefined : body);
    } catch (error) {
      response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`Preview upstream failed: ${error.message}`);
    }
  });
}

// Importing this module in tests must not start a listening server.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DEV_PORT || 3000);
  createPreviewServer().listen(port, () => {
    console.log(`Storefront preview: http://localhost:${port}${PROJECT_PATH}/`);
  });
}
