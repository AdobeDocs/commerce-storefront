import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const resolverSource = await readFile(new URL('../../src/pages/blocks/project-blocks.js', import.meta.url), 'utf8');
const sharedSource = await readFile(new URL('../../../adp-devsite/hlx_statics/scripts/lib-helix.js', import.meta.url), 'utf8');
const origin = 'http://project.test';
const prefix = '/commerce/storefront/';

test.beforeEach(async ({ page }) => {
  const scripts = new Map([
    [`${prefix}blocks/project-blocks.js`, resolverSource],
    ['/hlx_statics/scripts/lib-helix.js', sharedSource],
    ['/hlx_statics/scripts/lib-adobeio.js', 'export const isLocalHostEnvironment = () => true; export const isStageEnvironment = () => false; export const getFranklinSubfolders = () => [];'],
    ['/hlx_statics/blocks/fragment/fragment.js', 'export const loadFragment = async () => null;'],
  ]);
  await page.route(`${origin}/**`, (route) => {
    const source = scripts.get(new URL(route.request().url()).pathname);
    return route.fulfill({
      contentType: source ? 'text/javascript' : 'text/html',
      body: source || '<!doctype html><html></html>',
    });
  });
  await page.goto(`${origin}${prefix}`);
  await page.evaluate(async () => {
    window.resolveProjectBlock = (await import('/commerce/storefront/blocks/project-blocks.js')).default;
    window.sharedLoader = await import('/hlx_statics/scripts/lib-helix.js');
  });
});

async function resolveResources(page, resources, blockName = 'storefronthome') {
  return page.evaluate(async ({ assets, name }) => {
    window.fetch = async () => ({ ok: true, json: async () => ({ storefronthome: assets }) });
    return window.resolveProjectBlock(name);
  }, { assets: resources, name: blockName });
}

test('resolves assets relative to its own manifest and caches it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let calls = 0;
    let manifestURL;
    window.fetch = async (url) => {
      calls += 1;
      manifestURL = url;
      return {
        ok: true,
        json: async () => ({ storefronthome: {
          js: 'storefronthome/storefronthome.js', css: 'storefronthome/storefronthome.css',
        } }),
      };
    };
    const first = await window.resolveProjectBlock('storefronthome');
    const second = await window.resolveProjectBlock('storefronthome');
    return { first, second, calls, manifestURL };
  });
  expect(result.first).toEqual({
    js: `${origin}${prefix}blocks/storefronthome/storefronthome.js`,
    css: `${origin}${prefix}blocks/storefronthome/storefronthome.css`,
  });
  expect(result.second).toEqual(result.first);
  expect(result.calls).toBe(1);
  expect(result.manifestURL).toBe(`${origin}${prefix}blocks/blocks.json`);
});

test('keeps unregistered shared blocks on the shared path', async ({ page }) => {
  expect(await resolveResources(page, { js: 'home.js', css: 'home.css' }, 'cards')).toBeNull();
});

test('does not fetch without opt-in or with an invalid block name', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let calls = 0;
    window.fetch = async () => { calls += 1; };
    const values = await Promise.all([
      window.resolveProjectBlock('cards', null, '/commerce/storefront/'),
      window.resolveProjectBlock('../cards'),
    ]);
    return { calls, values };
  });
  expect(result).toEqual({ calls: 0, values: [null, null] });
});

test('rejects manifests outside the project without fetching them', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let calls = 0;
    window.fetch = async () => { calls += 1; };
    const values = await Promise.all(['https://example.com/blocks.json', '/other/blocks.json', '../blocks.json']
      .map((path) => window.resolveProjectBlock('storefronthome', path, '/commerce/storefront/')));
    return { calls, values };
  });
  expect(result).toEqual({ calls: 0, values: [null, null, null] });
});

for (const js of [
  'https://example.com/home.js', '../../../home.js', '/other/home.js',
  '/commerce/storefront/blocks/%2fother/home.js', 'home.html',
]) {
  test(`rejects invalid JavaScript asset ${js}`, async ({ page }) => {
    expect(await resolveResources(page, { js, css: 'home.css' })).toBeNull();
  });
}

test('rejects stylesheets outside the project', async ({ page }) => {
  expect(await resolveResources(page, { js: 'home.js', css: '../../../home.css' })).toBeNull();
});

test('falls back for missing, malformed, or unavailable manifests', async ({ page }) => {
  expect(await resolveResources(page, { js: 'home.js' })).toBeNull();
  const values = await page.evaluate(async () => {
    window.fetch = async () => ({ ok: false });
    const missing = await window.resolveProjectBlock('storefronthome', 'blocks/missing.json', '/commerce/storefront/');
    window.fetch = async () => { throw new Error('Unavailable'); };
    const unavailable = await window.resolveProjectBlock('storefronthome', 'blocks/unavailable.json', '/commerce/storefront/');
    return [missing, unavailable];
  });
  expect(values).toEqual([null, null]);
});

async function optIn(page, loaderPath = 'blocks/project-blocks.js') {
  await page.evaluate((path) => {
    for (const [name, content] of [['pathprefix', '/commerce/storefront/'], ['project-blocks', path]]) {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.append(meta);
    }
  }, loaderPath);
}

test('shared hook uses the Commerce-owned resolver', async ({ page }) => {
  await optIn(page);
  await resolveResources(page, { js: 'home.js', css: 'home.css' });
  expect(await page.evaluate(() => window.sharedLoader.getProjectBlockResources('storefronthome')))
    .toEqual({ js: `${origin}${prefix}blocks/home.js`, css: `${origin}${prefix}blocks/home.css` });
});

for (const loaderPath of ['https://example.com/loader.js', '/other/loader.js', '../loader.js', 'blocks/%2floader.js', 'blocks/blocks.json']) {
  test(`shared hook rejects invalid loader ${loaderPath}`, async ({ page }) => {
    await optIn(page, loaderPath);
    expect(await page.evaluate(() => window.sharedLoader.getProjectBlockResources('storefronthome'))).toBeNull();
  });
}

for (const resources of [
  { js: 'https://example.com/home.js', css: `${prefix}blocks/home.css` },
  { js: `${prefix}blocks/home.js`, css: '/other/home.css' },
  { js: `${prefix}blocks/%2fother/home.js`, css: `${prefix}blocks/home.css` },
  { js: `${prefix}blocks/home.html`, css: `${prefix}blocks/home.css` },
]) {
  test(`shared hook validates returned resources ${JSON.stringify(resources)}`, async ({ page }) => {
    await page.route('**/blocks/custom.js', (route) => route.fulfill({
      contentType: 'text/javascript', body: `export default async () => (${JSON.stringify(resources)});`,
    }));
    await optIn(page, 'blocks/custom.js');
    expect(await page.evaluate(() => window.sharedLoader.getProjectBlockResources('storefronthome'))).toBeNull();
  });
}

test('broken project loader falls back to shared decoration', async ({ page }) => {
  await page.route('**/blocks/broken.js', (route) => route.fulfill({
    contentType: 'text/javascript', body: 'export default () => { throw new Error("broken"); };',
  }));
  await page.route('**/cards/cards.js', (route) => route.fulfill({
    contentType: 'text/javascript', body: 'export default block => { block.dataset.decorated = "shared"; };',
  }));
  await page.route('**/cards/cards.css', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await optIn(page, 'blocks/broken.js');
  const result = await page.evaluate(async () => {
    const block = document.createElement('div');
    block.className = 'cards';
    block.dataset.blockName = 'cards';
    document.body.append(block);
    await window.sharedLoader.loadBlock(block);
    return { decorated: block.dataset.decorated, status: block.dataset.blockStatus };
  });
  expect(result).toEqual({ decorated: 'shared', status: 'loaded' });
});

test('shared loader decorates a registered project block', async ({ page }) => {
  await page.route('**/blocks/probe.js', (route) => route.fulfill({
    contentType: 'text/javascript', body: 'export default block => { block.dataset.decorated = "project"; };',
  }));
  await page.route('**/blocks/probe.css', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await optIn(page);
  const result = await page.evaluate(async () => {
    window.fetch = async () => ({ ok: true, json: async () => ({ probe: { js: 'probe.js', css: 'probe.css' } }) });
    const block = document.createElement('div');
    block.className = 'probe';
    block.dataset.blockName = 'probe';
    document.body.append(block);
    await window.sharedLoader.loadBlock(block);
    return { decorated: block.dataset.decorated, status: block.dataset.blockStatus };
  });
  expect(result).toEqual({ decorated: 'project', status: 'loaded' });
});