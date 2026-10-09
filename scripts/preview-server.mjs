import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

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

export function createPreviewServer({
  connectorOrigin = 'http://127.0.0.1:3002',
  assetsOrigin = 'http://127.0.0.1:3001',
} = {}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const isDocumentation = url.pathname === '/commerce/storefront'
        || url.pathname.startsWith('/commerce/storefront/');
      const upstream = new URL(`${url.pathname}${url.search}`, isDocumentation ? connectorOrigin : assetsOrigin);
      const result = await fetch(upstream, {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      const headers = Object.fromEntries(result.headers);
      for (const name of [
        'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
        'te', 'trailer', 'transfer-encoding', 'upgrade', 'content-length', 'content-encoding',
      ]) delete headers[name];
      if (isDocumentation && !headers['cache-control']) headers['cache-control'] = 'no-cache';

      let body = Buffer.from(await result.arrayBuffer());
      if (isDocumentation && headers['content-type']?.includes('text/html')) {
        const html = rewriteIcons(body.toString('utf8'));
        body = Buffer.from(html.replace('</head>',
          '<link rel="stylesheet" href="/hlx_statics/styles/styles.css">'
          + '<script src="/hlx_statics/scripts/scripts.js" type="module"></script></head>'));
      }
      if (request.method !== 'HEAD' && result.status !== 204 && result.status !== 304) {
        headers['content-length'] = String(body.length);
      }
      response.writeHead(result.status, headers);
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`Preview upstream failed: ${error.message}`);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DEV_PORT || 3000);
  createPreviewServer().listen(port, () => {
    console.log(`Storefront preview: http://localhost:${port}/commerce/storefront/`);
  });
}