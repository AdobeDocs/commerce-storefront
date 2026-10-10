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
    <main>
      <div class="storefronthome-wrapper"><div class="storefronthome"><div><div>
        <h2 data-section="hero">Hero</h2>
      </div></div></div></div>
      <div class="default-content-wrapper">
        <p data-field="eyebrow">Eyebrow: Documentation</p>
        <p data-field="headline">Headline: Create the fastest</p>
        <p data-field="highlight">Highlight: storefronts on the web</p>
        <p data-field="description">Description: Build with Adobe Commerce and Edge Delivery Services.</p>
      <h2 data-section="shortcuts">Shortcuts</h2><ul>
        <li><a href="/developers/">Developers</a></li>
        <li><a href="/authors/">Authors</a></li>
        <li><a href="/how-tos/">How-tos</a></li>
        <li><a href="/reference/">API Reference</a></li>
        <li><a href="/releases/">Releases</a></li>
      </ul>
      <h2 data-section="search">Search</h2>
      <p data-field="search">Label: Search the documentation</p>
      <h2 data-section="developers">Developers</h2>
      <p>Heading: <a href="/developers/">For developers</a></p>
          <h3 data-category><a href="/getting-started/">Getting started</a></h3><ul>
            <li><a href="/prerequisites/">Prerequisites</a></li>
            <li><a href="/backends/">Backend options</a></li>
          </ul>
      <h2 data-section="authors">Authors</h2>
      <p>Heading: <a href="/authors/">For authors</a></p>
          <h3 data-category><a href="/authoring/">Authoring</a></h3><ul>
            <li><a href="/blocks/">Add a block</a></li>
          </ul>
      </div>
      <div class="other-block">Unrelated block</div>
    </main>`);
});

async function decorateFixture(page) {
  await page.evaluate(async (url) => {
    const { default: decorate } = await import(url);
    decorate(document.querySelector('.storefronthome'));
  }, moduleURL);
}

async function omitSections(page, names) {
  await page.evaluate((omitted) => {
    const cell = document.querySelector('.storefronthome > div > div');
    const content = document.querySelector('.default-content-wrapper');
    const sections = [];
    for (const node of [...cell.children, ...content.children]) {
      if (node.tagName === 'H2') sections.push({ name: node.textContent.toLowerCase(), nodes: [] });
      sections.at(-1).nodes.push(node);
    }
    const nodes = sections.filter((section) => !omitted.includes(section.name)).flatMap((section) => section.nodes);
    cell.replaceChildren(...nodes.slice(0, 1));
    content.replaceChildren(...nodes.slice(1));
  }, names);
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

test('leaves source intact when the first heading is unrecognized', async ({ page }) => {
  await page.locator('[data-section="hero"]').evaluate((hero) => { hero.textContent = 'HeroBanner'; });
  const original = await page.locator('main').innerHTML();
  await decorateFixture(page);
  expect(await page.locator('main').innerHTML()).toBe(original);
});

test('preserves the headline and creates five icon shortcuts', async ({ page }) => {
  await decorateFixture(page);
  await expect(page.locator('h1')).toHaveText('Create the fastest storefronts on the web');
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

test('uses authored labels for the eyebrow and every search control', async ({ page }) => {
  await page.locator('[data-field="eyebrow"]').evaluate((field) => { field.textContent = 'Eyebrow: Commerce documentation'; });
  await page.locator('[data-field="search"]').evaluate((field) => { field.textContent = 'Label: Find a storefront topic'; });
  await decorateFixture(page);
  await expect(page.locator('.storefront-home__eyebrow')).toHaveText('Commerce documentation');
  await expect(page.locator('.storefront-home__shortcuts')).toHaveAttribute('aria-label', 'Commerce documentation');
  await expect(page.locator('.storefront-home__search-label')).toHaveText('Find a storefront topic');
  await expect(page.locator('.storefront-home__search input')).toHaveAttribute('placeholder', 'Find a storefront topic');
  await expect(page.locator('.storefront-home__search button')).toHaveAttribute('aria-label', 'Find a storefront topic');
  await expect(page.locator('.storefront-home__search button')).toHaveAttribute('title', 'Find a storefront topic');
});

test('highlights a plain-text field without formatting markers', async ({ page }) => {
  await page.locator('[data-field="headline"]').evaluate((field) => { field.textContent = 'Headline: Build'; });
  await page.locator('[data-field="highlight"]').evaluate((field) => { field.textContent = 'Highlight: a better storefront'; });
  await decorateFixture(page);
  await expect(page.locator('h1')).toHaveText('Build a better storefront');
  await expect(page.locator('.storefront-home__highlight')).toHaveText('a better storefront');
});

test('preserves a headline without a highlight field', async ({ page }) => {
  await page.locator('[data-field="headline"]').evaluate((field) => { field.textContent = 'Headline: Build a storefront'; });
  await page.locator('[data-field="highlight"]').evaluate((field) => field.remove());
  await decorateFixture(page);
  await expect(page.locator('h1')).toHaveText('Build a storefront');
  await expect(page.locator('.storefront-home__highlight')).toHaveCount(0);
  await expect(page.locator('.storefront-home__audience')).toHaveCount(2);
});

test('accepts ordinary paragraphs and values containing colons', async ({ page }) => {
  await page.locator('[data-field="description"]').evaluate((field) => {
    field.textContent = 'Description: Start here: build a storefront.';
  });
  await decorateFixture(page);
  await expect(page.locator('.storefront-home__description')).toHaveText('Start here: build a storefront.');
  await expect(page.locator('.storefront-home__audience')).toHaveCount(2);
});

test('balances the hero description without an orphaned final line', async ({ page }) => {
  const description = 'Learn to build Adobe Commerce storefronts using Edge Delivery Services, Commerce blocks, and Commerce drop-in components.';
  await page.locator('[data-field="description"]').evaluate((field, text) => {
    field.textContent = `Description: ${text}`;
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
  await page.locator('[data-category] + ul').first().evaluate((list) => list.remove());
  const original = await page.locator('main').innerHTML();
  await decorateFixture(page);
  expect(await page.locator('main').innerHTML()).toBe(original);
});

test('leaves source intact when an authored label is missing', async ({ page }) => {
  await page.locator('[data-field="search"]').evaluate((field) => { field.textContent = 'Label: '; });
  const original = await page.locator('main').innerHTML();
  await decorateFixture(page);
  expect(await page.locator('main').innerHTML()).toBe(original);
});

test('finds sections and fields by name regardless of order or casing', async ({ page }) => {
  await page.locator('[data-section="hero"]').evaluate((hero) => {
    hero.textContent = '  hErO  ';
    const wrapper = document.querySelector('.default-content-wrapper');
    const groups = [[]];
    for (const node of wrapper.children) {
      if (node.tagName === 'H2') groups.push([]);
      groups.at(-1).push(node);
    }
    wrapper.replaceChildren(...groups[0].reverse(), ...groups.slice(1).reverse().flat());
  });
  await decorateFixture(page);
  await expect(page.locator('h1')).toHaveText('Create the fastest storefronts on the web');
  await expect(page.locator('.storefront-home__audience-title')).toHaveText(['For developers', 'For authors']);
  await expect(page.locator('.storefront-home__shortcut').first()).toHaveText('Developers');
});

test('renders plain category names without requiring links or bold markers', async ({ page }) => {
  await page.locator('[data-category] > a').first().evaluate((link) => {
    link.replaceWith(document.createTextNode('Getting started'));
  });
  await decorateFixture(page);
  await expect(page.locator('.storefront-home__category-title').first()).toHaveText('Getting started');
  await expect(page.locator('.storefront-home__category ul').first().locator('a')).toHaveCount(2);
});

test('leaves source intact when section names are duplicated', async ({ page }) => {
  await page.locator('[data-section="hero"]').evaluate((hero) => hero.parentElement.append(hero.cloneNode(true)));
  const original = await page.locator('main').innerHTML();
  await decorateFixture(page);
  expect(await page.locator('main').innerHTML()).toBe(original);
});

test('supports unwrapped Markdown and preserves unrelated blocks', async ({ page }) => {
  await page.evaluate(() => {
    const content = document.querySelector('.default-content-wrapper');
    content.replaceWith(...content.childNodes);
    const wrapper = document.querySelector('.storefronthome-wrapper');
    wrapper.replaceWith(wrapper.firstElementChild);
  });
  await decorateFixture(page);
  await expect(page.locator('.storefront-home__hero')).toHaveCount(1);
  await expect(page.locator('.other-block')).toHaveText('Unrelated block');
  await expect(page.locator('main > h2, main > h3, main > p, main > ul')).toHaveCount(0);
});

test('reads runtime heading blocks without retaining generated anchors or styles', async ({ page }) => {
  const links = await page.locator('main a').evaluateAll((elements) => elements.map((link) => link.getAttribute('href')));
  await page.locator('.default-content-wrapper').evaluate((content) => {
    const wrappers = [];
    let defaultContent;
    for (const node of [...content.children]) {
      if (node.matches('h2, h3')) {
        const wrapper = document.createElement('div');
        wrapper.className = `heading${node.tagName.slice(1)}-wrapper`;
        wrapper.innerHTML = '<div><div><div></div></div></div>';
        node.className = 'spectrum-Heading';
        node.insertAdjacentHTML('beforeend', '<span><a class="anchor-link" href="#generated" aria-label="Anchor"></a></span>');
        wrapper.firstElementChild.firstElementChild.firstElementChild.append(node);
        wrappers.push(wrapper);
        defaultContent = null;
      } else {
        if (!defaultContent) {
          defaultContent = document.createElement('div');
          defaultContent.className = 'default-content-wrapper';
          wrappers.push(defaultContent);
        }
        defaultContent.append(node);
      }
    }
    content.replaceWith(...wrappers);
  });
  await decorateFixture(page);
  await expect(page.locator('.storefront-home__hero')).toHaveCount(1);
  await expect(page.locator('.default-content-wrapper, .heading2-wrapper, .heading3-wrapper')).toHaveCount(0);
  await expect(page.locator('.storefront-home__category-title.spectrum-Heading, .storefronthome .anchor-link')).toHaveCount(0);
  expect(await page.locator('main a').evaluateAll((elements) => elements.map((link) => link.getAttribute('href'))))
    .toEqual(links);
  await expect(page.locator('.other-block')).toHaveText('Unrelated block');
});

test('stops at an unrelated section and preserves its content', async ({ page }) => {
  await page.locator('.default-content-wrapper').evaluate((wrapper) => {
    wrapper.insertAdjacentHTML('beforeend', '<h2>More resources</h2><p><a href="/more/">More documentation</a></p>');
  });
  await decorateFixture(page);
  await expect(page.locator('.storefront-home__hero')).toHaveCount(1);
  await expect(page.locator('.default-content-wrapper h2')).toHaveText('More resources');
  await expect(page.locator('.default-content-wrapper a')).toHaveAttribute('href', '/more/');
  await expect(page.locator('.other-block')).toHaveText('Unrelated block');
});

for (const omitted of [
  ['search'],
  ['shortcuts'],
  ['hero'],
  ['developers'],
  ['authors'],
  ['developers', 'authors'],
  ['hero', 'shortcuts', 'search'],
  ['hero', 'shortcuts', 'developers', 'authors'],
]) {
  test(`renders only included sections when omitting ${omitted.join(', ')}`, async ({ page }) => {
    await omitSections(page, omitted);
    const links = await page.locator('main a').evaluateAll((elements) => elements.map((link) => link.getAttribute('href')));
    await decorateFixture(page);
    await expect(page.locator('.storefront-home__title')).toHaveCount(omitted.includes('hero') ? 0 : 1);
    await expect(page.locator('.storefront-home__eyebrow, .storefront-home__description'))
      .toHaveCount(omitted.includes('hero') ? 0 : 2);
    await expect(page.locator('.storefront-home__shortcuts')).toHaveCount(omitted.includes('shortcuts') ? 0 : 1);
    await expect(page.locator('.storefront-home__search')).toHaveCount(omitted.includes('search') ? 0 : 1);
    const audienceCount = ['developers', 'authors'].filter((name) => !omitted.includes(name)).length;
    await expect(page.locator('.storefront-home__audience')).toHaveCount(audienceCount);
    await expect(page.locator('.storefront-home__directory')).toHaveCount(audienceCount ? 1 : 0);
    await expect(page.locator('.storefront-home__hero'))
      .toHaveCount(['hero', 'shortcuts', 'search'].every((name) => omitted.includes(name)) ? 0 : 1);
    await expect(page.locator('.default-content-wrapper')).toHaveCount(0);
    await expect(page.locator('.other-block')).toHaveText('Unrelated block');
    expect(await page.locator('main a').evaluateAll((elements) => elements.map((link) => link.getAttribute('href'))))
      .toEqual(links);

    if (audienceCount === 1) {
      await page.addStyleTag({ content: stylesheet });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const layout = await page.locator('.storefront-home__directory').evaluate((directory) => {
          const audience = directory.firstElementChild;
          const style = getComputedStyle(directory);
          const audienceStyle = getComputedStyle(audience);
          return {
            columns: style.gridTemplateColumns.split(' ').length,
            availableWidth: directory.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            audienceWidth: audience.getBoundingClientRect().width,
            leftBorder: audienceStyle.borderLeftWidth,
            topBorder: audienceStyle.borderTopWidth,
          };
        });
        expect(layout.columns).toBe(1);
        expect(layout.audienceWidth).toBeCloseTo(layout.availableWidth, 0);
        expect(layout.leftBorder).toBe('0px');
        expect(layout.topBorder).toBe('0px');
      }
    }
  });
}

for (const section of ['hero', 'shortcuts', 'developers']) {
  test(`leaves source intact when included ${section} content is empty`, async ({ page }) => {
    await page.locator(`[data-section="${section}"]`).evaluate((heading) => {
      const container = document.querySelector('.default-content-wrapper');
      let node = heading.nextElementSibling || container.firstElementChild;
      while (node && node.tagName !== 'H2') {
        const next = node.nextElementSibling;
        node.remove();
        node = next;
      }
    });
    const original = await page.locator('main').innerHTML();
    await decorateFixture(page);
    expect(await page.locator('main').innerHTML()).toBe(original);
  });
}

test('leaves an empty block and unrelated content untouched', async ({ page }) => {
  await omitSections(page, ['hero', 'shortcuts', 'search', 'developers', 'authors']);
  const original = await page.locator('main').innerHTML();
  await decorateFixture(page);
  expect(await page.locator('main').innerHTML()).toBe(original);
});
