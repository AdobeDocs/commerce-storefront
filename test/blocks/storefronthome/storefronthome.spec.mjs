import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const source = await readFile(new URL('../../../src/pages/blocks/storefronthome/storefronthome.js', import.meta.url), 'utf8');
const moduleURL = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const stylesheet = await readFile(new URL('../../../src/pages/blocks/storefronthome/storefronthome.css', import.meta.url), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.setContent(`
    <header>
      <button class="nav-dropdown-search">Search</button>
      <input id="search-input" />
    </header>
    <main><div class="storefronthome"><div>
      <div><h1>Create the fastest storefronts on the web</h1></div>
      <div><p>Build with Adobe Commerce and Edge Delivery Services.</p></div>
      <div><ul>
        <li><a href="/developers/">Developers</a></li>
        <li><a href="/authors/">Authors</a></li>
        <li><a href="/how-tos/">How-tos</a></li>
        <li><a href="/reference/">API Reference</a></li>
        <li><a href="/releases/">Releases</a></li>
      </ul></div>
      <div><h2><a href="/developers/">For developers</a></h2></div>
      <div><ul><li><strong><a href="/getting-started/">Getting started</a></strong>
        <ul><li><a href="/prerequisites/">Prerequisites</a></li>
          <li><a href="/backends/">Backend options</a></li></ul>
      </li></ul></div>
      <div><h2><a href="/authors/">For authors</a></h2></div>
      <div><ul><li><strong><a href="/authoring/">Authoring</a></strong>
        <ul><li><a href="/blocks/">Add a block</a></li></ul>
      </li></ul></div>
    </div></div></main>`);
});

async function decorateFixture(page) {
  await page.evaluate(async (url) => {
    const { default: decorate } = await import(url);
    decorate(document.querySelector('.storefronthome'));
  }, moduleURL);
}

test('preserves every link and builds two semantic audience grids', async ({ page }) => {
  const links = await page.locator('main a').evaluateAll((elements) => elements.map((link) => link.getAttribute('href')));
  await decorateFixture(page);
  expect(await page.locator('main a').evaluateAll((elements) => elements.map((link) => link.getAttribute('href'))))
    .toEqual(links);
  await expect(page.locator('.storefront-home__audience')).toHaveCount(2);
  await expect(page.locator('.storefront-home__category-grid')).toHaveCount(2);
  await expect(page.locator('.storefront-home__category h3')).toHaveCount(2);
  await expect(page.locator('.storefront-home__category ul ul')).toHaveCount(0);
  await expect(page.locator('main')).toHaveClass('storefront-home-page');
});

test('preserves the headline and creates five icon shortcuts', async ({ page }) => {
  const title = await page.locator('h1').textContent();
  await decorateFixture(page);
  await expect(page.locator('h1')).toHaveText(title);
  await expect(page.locator('.storefront-home__highlight')).toHaveText('storefronts on the web');
  await expect(page.locator('.storefront-home__shortcut')).toHaveCount(5);
  await expect(page.locator('.storefront-home__shortcut img')).toHaveCount(5);
});

test('opens native search with the submitted query', async ({ page }) => {
  await page.locator('header button').evaluate((button) => {
    button.addEventListener('click', () => { button.dataset.opened = 'true'; });
  });
  await decorateFixture(page);
  await page.locator('.storefront-home__search input').fill('product details');
  await page.locator('.storefront-home__search input').press('Enter');
  await expect(page.locator('header button')).toHaveAttribute('data-opened', 'true');
  await expect(page.locator('#search-input')).toHaveValue('product details');
  await expect(page.locator('#search-input')).toBeFocused();
});

test('accepts the connector description slot without a paragraph wrapper', async ({ page }) => {
  await page.locator('.storefronthome > div > div').nth(1).evaluate((cell) => {
    cell.replaceChildren('Build a storefront.');
  });
  await decorateFixture(page);
  await expect(page.locator('.storefront-home__description')).toHaveText('Build a storefront.');
  await expect(page.locator('.storefront-home__audience')).toHaveCount(2);
});

test('balances the hero description without an orphaned final line', async ({ page }) => {
  const description = 'Learn to build Adobe Commerce storefronts using Edge Delivery Services, Commerce blocks, and Commerce drop-in components.';
  await page.locator('.storefronthome > div > div').nth(1).locator('p').evaluate((paragraph, text) => {
    paragraph.textContent = text;
  }, description);
  await decorateFixture(page);
  await page.addStyleTag({ content: stylesheet });

  for (const width of [1440, 519, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const paragraph = page.locator('.storefront-home__description');
    await expect(paragraph).toHaveText(description);
    const layout = await paragraph.evaluate((element) => {
      const text = element.firstChild;
      const lines = new Map();
      for (let index = 0; index < text.length; index += 1) {
        const range = document.createRange();
        range.setStart(text, index);
        range.setEnd(text, index + 1);
        const top = Math.round(range.getBoundingClientRect().top);
        lines.set(top, (lines.get(top) || '') + text.textContent[index]);
      }
      const rect = element.getBoundingClientRect();
      return {
        wrapping: getComputedStyle(element).textWrap,
        left: rect.left,
        right: rect.right,
        lines: [...lines.values()].map((line) => line.trim()),
      };
    });
    expect(layout.wrapping).toBe('balance');
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(width);
    expect(layout.lines.at(-1).split(/\s+/).length).toBeGreaterThan(1);
  }
});

test('leaves malformed source content intact', async ({ page }) => {
  await page.locator('strong').first().evaluate((element) => element.remove());
  const original = await page.locator('.storefronthome').innerHTML();
  await decorateFixture(page);
  expect(await page.locator('.storefronthome').innerHTML()).toBe(original);
});
