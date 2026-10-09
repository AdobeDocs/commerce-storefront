const projectBlockManifests = new Map();

export default async function getProjectBlockResources(
  blockName,
  manifestPath = new URL('./blocks.json', import.meta.url).href,
  pathPrefix = '/commerce/storefront/',
) {
  if (!manifestPath || !pathPrefix || !/^[a-z0-9][a-z0-9-]*$/.test(blockName)) return null;
  if (!/^\/?[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/?$/i.test(pathPrefix)) return null;

  try {
    const projectURL = new URL(`/${pathPrefix.replace(/^\/+|\/+$/g, '')}/`, window.location.origin);
    const manifestURL = new URL(manifestPath, projectURL);
    const isProjectURL = (url) => url.origin === projectURL.origin
      && url.pathname.startsWith(projectURL.pathname)
      && !/%(?:2e|2f|5c)/i.test(url.pathname);
    if (!isProjectURL(manifestURL) || !manifestURL.pathname.endsWith('.json')) return null;

    if (!projectBlockManifests.has(manifestURL.href)) {
      projectBlockManifests.set(manifestURL.href, fetch(manifestURL.href)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null));
    }
    const manifest = await projectBlockManifests.get(manifestURL.href);
    if (!manifest || !Object.hasOwn(manifest, blockName)) return null;
    const resources = manifest[blockName];
    if (typeof resources?.js !== 'string' || typeof resources?.css !== 'string') return null;
    const js = new URL(resources.js, manifestURL);
    const css = new URL(resources.css, manifestURL);
    if (!isProjectURL(js) || !isProjectURL(css)
      || !js.pathname.endsWith('.js') || !css.pathname.endsWith('.css')) return null;
    return { js: js.href, css: css.href };
  } catch {
    return null;
  }
}