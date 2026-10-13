const projectBlockManifests = new Map();
// Block names allow lowercase letters, digits, and hyphens, starting with a letter or digit.
const BLOCK_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
// Project paths allow simple slash-separated segments with optional outer slashes.
const PROJECT_PATH_PATTERN = /^\/?[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/?$/i;
// Encoded dots, slashes, and backslashes can be interpreted differently by downstream servers.
const FORBIDDEN_PATH_ENCODINGS = ['%2e', '%2f', '%5c'];

/**
 * Checks that a resource stays on the project origin and under its path, with the expected file type.
 * Rejects ambiguous encodings so project assets cannot escape these boundaries downstream.
 */
function isProjectResource(url, projectURL, extension) {
  const lowercasePath = url.pathname.toLowerCase();
  const hasForbiddenEncoding = FORBIDDEN_PATH_ENCODINGS.some(
    (encoding) => lowercasePath.includes(encoding),
  );

  return url.origin === projectURL.origin
    && url.pathname.startsWith(projectURL.pathname)
    && !hasForbiddenEncoding
    && url.pathname.endsWith(extension);
}

  /**
   * Fetches the JSON manifest, returning null for HTTP, network, or JSON parsing failures.
   * An unavailable project manifest should allow shared-block fallback rather than stop page loading.
   */
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

/**
 * Resolves a registered block's JavaScript and stylesheet URLs from the project manifest.
 * Returns null when configuration or assets are missing or unsafe, allowing the runtime's shared lookup.
 */
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
    // Normalize the prefix once so containment checks include a trailing slash boundary.
    const projectPath = pathPrefix.replace(/^\/+|\/+$/g, '');
    const projectURL = new URL(`/${projectPath}/`, window.location.origin);
    const manifestURL = new URL(manifestPath, projectURL);
    if (!isProjectResource(manifestURL, projectURL, '.json')) {
      return null;
    }

    // Cache the promise immediately so concurrent blocks share one request, including failed requests.
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

    // Asset paths are relative to the manifest, not the page currently being viewed.
    const javascriptURL = new URL(resources.js, manifestURL);
    const stylesheetURL = new URL(resources.css, manifestURL);
    const isJavaScriptAllowed = isProjectResource(javascriptURL, projectURL, '.js');
    const isStylesheetAllowed = isProjectResource(stylesheetURL, projectURL, '.css');
    if (!isJavaScriptAllowed || !isStylesheetAllowed) {
      return null;
    }

    return { js: javascriptURL.href, css: stylesheetURL.href };
  } catch {
    // Invalid URL construction or unexpected manifest values must also preserve shared-block fallback.
    return null;
  }
}