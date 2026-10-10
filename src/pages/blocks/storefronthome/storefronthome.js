const ICON_ROOT = 'https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/icons/';
const SHORTCUT_ICONS = ['braces', 'file-text', 'footprints', 'book-open', 'rocket'];

/**
 * index.md supplies content; this file builds HTML; storefronthome.css styles it.
 * DevDocs converts the Markdown to HTML before calling decorate().
 */
const PAGE_TEMPLATE = `
  <section class="storefront-home__hero">
    <p class="storefront-home__eyebrow"></p>
    <h1 class="storefront-home__title"></h1>
    <p class="storefront-home__description"></p>
    <nav class="storefront-home__shortcuts"></nav>
    <form class="storefront-home__search" role="search">
      <label class="storefront-home__search-label" for="storefront-home-search"></label>
      <button type="submit"></button>
      <input id="storefront-home-search" type="search" autocomplete="off">
    </form>
  </section>
  <div class="storefront-home__directory"></div>
`;

export default function decorate(block) {
  const content = readContent(block);
  if (!content) return;

  const page = renderPage(content);
  connectSearch(page);
  block.replaceChildren(page);
  removeSourceContent(block, content);

  block.classList.add('storefronthome');
  const main = block.closest('main');
  if (main) main.classList.add('storefront-home-page');
  block.setAttribute('daa-lh', 'storefront-home');
}

/** Reads ## sections, including headings wrapped in blocks by DevDocs. */
function readSections(block) {
  const sectionNames = ['hero', 'shortcuts', 'search', 'developers', 'authors'];
  const firstRow = block.firstElementChild;
  const firstCell = firstRow?.firstElementChild;
  const nodes = firstCell ? Array.from(firstCell.children) : [];
  const headingOwners = new Map();
  const wrapper = block.closest('.storefronthome-wrapper') || block;

  for (let sibling = wrapper.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    if (sibling.classList.contains('default-content-wrapper')) {
      nodes.push(...sibling.children);
    } else if (sibling.matches('.heading2-wrapper, .heading3-wrapper')) {
      const heading = sibling.querySelector('h2, h3');
      if (!heading) return null;

      nodes.push(heading);
      headingOwners.set(heading, sibling);
    } else if (['H2', 'H3', 'P', 'UL'].includes(sibling.tagName)) {
      nodes.push(sibling);
    } else {
      break;
    }
  }

  const sections = new Map();
  const source = [];
  const headingWrappers = [];
  let currentSection;

  for (const node of nodes) {
    if (node.tagName === 'H2') {
      const sectionName = node.textContent.trim().toLowerCase();
      if (!sectionNames.includes(sectionName)) break;
      if (sections.has(sectionName)) return null;

      currentSection = [];
      sections.set(sectionName, currentSection);
    } else {
      if (!currentSection) return null;
      currentSection.push(node);
    }

    source.push(node);
    const headingWrapper = headingOwners.get(node);
    if (headingWrapper) headingWrappers.push(headingWrapper);
  }

  return { sections, source, headingWrappers };
}

/** Reads paragraphs such as "Headline: Create the fastest" into named fields. */
function readFields(nodes = []) {
  const fields = new Map();
  for (const node of nodes) {
    if (node.tagName !== 'P') continue;

    const paragraphText = node.textContent.trim();
    const colonIndex = paragraphText.indexOf(':');
    if (colonIndex < 0) continue;

    const fieldName = paragraphText.slice(0, colonIndex).trim().toLowerCase();
    const fieldText = paragraphText.slice(colonIndex + 1).trim();
    const fieldLink = node.querySelector('a');
    if (fields.has(fieldName)) return null;

    fields.set(fieldName, { text: fieldText, link: fieldLink });
  }
  return fields;
}

function readAudience(nodes) {
  const fields = readFields(nodes);
  const heading = fields?.get('heading');
  if (!heading?.text) return null;

  const categories = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const title = nodes[index];
    if (title.tagName !== 'H3') continue;

    const links = nodes[index + 1];
    if (!title.textContent.trim()) return null;
    if (links?.tagName !== 'UL') return null;
    if (links.children.length === 0) return null;

    categories.push({ title, links });
  }
  if (categories.length === 0) return null;
  return { heading, categories };
}

/** Omitted sections are optional; invalid included sections return null. */
function readContent(block) {
  const parsedSections = readSections(block);
  if (!parsedSections) return null;

  const { sections, source, headingWrappers } = parsedSections;
  if (sections.size === 0) return null;

  const heroFields = readFields(sections.get('hero'));
  const searchFields = readFields(sections.get('search'));
  const shortcuts = [];
  for (const node of sections.get('shortcuts') || []) {
    if (node.tagName !== 'UL') continue;

    const links = node.querySelectorAll(':scope > li > a, :scope > li > p > a');
    for (const link of links) shortcuts.push(link);
  }

  const audiences = [];
  for (const name of ['developers', 'authors']) {
    if (!sections.has(name)) continue;
    const audience = readAudience(sections.get(name));
    if (!audience) return null;
    audiences.push(audience);
  }

  const contentWrappers = new Set();
  for (const node of source) {
    const wrapper = node.closest('.default-content-wrapper');
    if (wrapper) contentWrappers.add(wrapper);
  }

  const content = {
    source,
    headingWrappers,
    contentWrappers: Array.from(contentWrappers),
    hasHero: sections.has('hero'),
    eyebrow: heroFields?.get('eyebrow')?.text,
    headline: heroFields?.get('headline')?.text,
    highlight: heroFields?.get('highlight')?.text || '',
    description: heroFields?.get('description')?.text,
    shortcuts,
    searchLabel: searchFields?.get('label')?.text,
    audiences,
  };

  if (content.hasHero) {
    if (!content.eyebrow) return null;
    if (!content.headline) return null;
    if (!content.description) return null;
  }
  if (sections.has('search') && !content.searchLabel) return null;
  if (sections.has('shortcuts') && content.shortcuts.length === 0) return null;
  return content;
}

function createTag(name, attributes) {
  const element = document.createElement(name);
  for (const [attributeName, attributeValue] of Object.entries(attributes)) {
    element.setAttribute(attributeName, attributeValue);
  }
  return element;
}

function createIcon(iconName) {
  return createTag('img', {
    class: 'storefront-home__icon',
    src: `${ICON_ROOT}${iconName}.svg`,
    alt: '',
    width: '18',
    height: '18',
  });
}

function connectSearch(page) {
  const form = page.querySelector('.storefront-home__search');
  if (!form) return;

  const homepageInput = form.querySelector('input');
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const headerSearchButton = document.querySelector('header .nav-dropdown-search');
    if (!headerSearchButton) return;
    headerSearchButton.click();

    const headerSearchInput = document.querySelector('header #search-input');
    if (!headerSearchInput) return;

    headerSearchInput.value = homepageInput.value;
    headerSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    headerSearchInput.focus();
  });
}

function createAudience(audienceContent) {
  const audience = createTag('section', { class: 'storefront-home__audience' });
  const heading = createTag('h2', { class: 'storefront-home__audience-title' });
  const headingContent = audienceContent.heading;
  heading.append(headingContent.link || headingContent.text);

  const grid = createTag('div', { class: 'storefront-home__category-grid' });
  for (const categoryContent of audienceContent.categories) {
    const category = createTag('section', { class: 'storefront-home__category' });
    const title = createTag('h3', { class: 'storefront-home__category-title' });
    const authoredTitle = categoryContent.title.cloneNode(true);

    const generatedAnchors = authoredTitle.querySelectorAll('.anchor-link');
    for (const anchor of generatedAnchors) anchor.parentElement.remove();

    title.append(...authoredTitle.childNodes);
    category.append(title, categoryContent.links);
    grid.append(category);
  }

  audience.append(heading, grid);
  return audience;
}

/** Fills the template's class-named elements, which are targeted by the CSS. */
function renderPage(content) {
  const template = document.createElement('template');
  template.innerHTML = PAGE_TEMPLATE;
  const page = template.content;

  renderHero(page, content);
  renderShortcuts(page, content);
  renderSearch(page, content);
  renderDirectory(page, content);

  const hasTopContent = content.hasHero || content.shortcuts.length > 0 || Boolean(content.searchLabel);
  const heroContainer = page.querySelector('.storefront-home__hero');
  if (!hasTopContent) heroContainer.remove();
  return page;
}

function renderHero(page, content) {
  const eyebrow = page.querySelector('.storefront-home__eyebrow');
  const title = page.querySelector('.storefront-home__title');
  const description = page.querySelector('.storefront-home__description');

  if (!content.hasHero) {
    eyebrow.remove();
    title.remove();
    description.remove();
    return;
  }

  eyebrow.textContent = content.eyebrow;
  title.textContent = content.headline;
  description.textContent = content.description;

  if (content.highlight) {
    const highlight = createTag('span', { class: 'storefront-home__highlight' });
    highlight.textContent = content.highlight;
    title.append(' ', highlight);
  }
}

function renderShortcuts(page, content) {
  const navigation = page.querySelector('.storefront-home__shortcuts');
  const links = content.shortcuts;
  if (links.length === 0) {
    navigation.remove();
    return;
  }

  if (content.eyebrow) navigation.setAttribute('aria-label', content.eyebrow);
  for (let index = 0; index < links.length; index += 1) {
    const link = links[index];
    const iconName = SHORTCUT_ICONS[index];
    link.classList.add('storefront-home__shortcut');
    if (iconName) link.prepend(createIcon(iconName));
    navigation.append(link);
  }
}

function renderSearch(page, content) {
  const form = page.querySelector('.storefront-home__search');
  if (!content.searchLabel) {
    form.remove();
    return;
  }

  const label = form.querySelector('label');
  const input = form.querySelector('input');
  const submitButton = form.querySelector('button');

  label.textContent = content.searchLabel;
  input.placeholder = content.searchLabel;
  submitButton.title = content.searchLabel;
  submitButton.setAttribute('aria-label', content.searchLabel);
  submitButton.append(createIcon('search'));
}

function renderDirectory(page, content) {
  const directory = page.querySelector('.storefront-home__directory');
  if (content.audiences.length === 0) {
    directory.remove();
    return;
  }

  for (const audienceContent of content.audiences) {
    const audience = createAudience(audienceContent);
    directory.append(audience);
  }
}

/** Removes consumed Markdown HTML, but keeps links moved into the finished page. */
function removeSourceContent(block, content) {
  for (const node of content.source) {
    if (block.contains(node)) continue;
    node.remove();
  }

  for (const wrapper of content.contentWrappers) {
    if (wrapper.children.length === 0) wrapper.remove();
  }

  for (const wrapper of content.headingWrappers) wrapper.remove();
}
