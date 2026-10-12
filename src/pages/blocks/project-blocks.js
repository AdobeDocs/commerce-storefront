const projectBlockManifests = new Map();
const BLOCK_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const PROJECT_PATH_PATTERN = /^\/?[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/?$/i;
const FORBIDDEN_PATH_ENCODINGS = ['%2e', '%2f', '%5c'];

function isProjectResource(url, projectURL, extension) {
  const lowercasePath = url.pathname.toLowerCase();
  const hasForbiddenEncoding = FORBIDDEN_PATH_ENCODINGS.some((encoding) => lowercasePath.includes(encoding));

  return url.origin === projectURL.origin
    && url.pathname.startsWith(projectURL.pathname)
    && !hasForbiddenEncoding
    && url.pathname.endsWith(extension);
}

async function fetchManifest(manifestURL) {
  try {
    const response = await fetch(manifestURL.href);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export default async function getProjectBlockResources(
  blockName,
  manifestPath = new URL('./blocks.json', import.meta.url).href,
  pathPrefix = '/commerce/storefront/',
) {
  if (!manifestPath || !pathPrefix || !BLOCK_NAME_PATTERN.test(blockName)) {
    return null;
  }
  if (!PROJECT_PATH_PATTERN.test(pathPrefix)) {
    return null;
  }

  try {
    const projectPath = pathPrefix.replace(/^\/+|\/+$/g, '');
    const projectURL = new URL(`/${projectPath}/`, window.location.origin);
    const manifestURL = new URL(manifestPath, projectURL);
    if (!isProjectResource(manifestURL, projectURL, '.json')) {
      return null;
    }

    if (!projectBlockManifests.has(manifestURL.href)) {
      projectBlockManifests.set(manifestURL.href, fetchManifest(manifestURL));
    }
    const manifest = await projectBlockManifests.get(manifestURL.href);
    if (!manifest || !Object.hasOwn(manifest, blockName)) {
      return null;
    }

    const resources = manifest[blockName];
    if (typeof resources?.js !== 'string' || typeof resources?.css !== 'string') {
      return null;
    }

    const javascriptURL = new URL(resources.js, manifestURL);
    const stylesheetURL = new URL(resources.css, manifestURL);
    if (!isProjectResource(javascriptURL, projectURL, '.js')
      || !isProjectResource(stylesheetURL, projectURL, '.css')) {
      return null;
    }

    return { js: javascriptURL.href, css: stylesheetURL.href };
  } catch {
    return null;
  }
}