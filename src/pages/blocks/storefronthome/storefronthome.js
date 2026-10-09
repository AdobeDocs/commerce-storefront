const ICON_ROOT = 'https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/icons/';
const SHORTCUT_ICONS = ['braces', 'file-text', 'footprints', 'book-open', 'rocket'];

function createTag(name, attributes) {
  const element = document.createElement(name);
  Object.entries(attributes).forEach(([attribute, value]) => {
    element.setAttribute(attribute, value);
  });
  return element;
}

function createIcon(name) {
  return createTag('img', {
    class: 'storefront-home__icon',
    src: `${ICON_ROOT}${name}.svg`,
    alt: '',
    width: '18',
    height: '18',
  });
}

function createSearch() {
  const form = createTag('form', { class: 'storefront-home__search', role: 'search' });
  const label = createTag('label', {
    class: 'storefront-home__search-label',
    for: 'storefront-home-search',
  });
  label.textContent = 'Search the documentation';
  const input = createTag('input', {
    id: 'storefront-home-search',
    type: 'search',
    placeholder: 'Search the documentation',
    autocomplete: 'off',
  });
  const button = createTag('button', {
    type: 'submit',
    title: 'Search the documentation',
    'aria-label': 'Search the documentation',
  });
  button.append(createIcon('search'));
  form.append(label, button, input);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const trigger = document.querySelector('header .nav-dropdown-search');
    if (!trigger) return;
    trigger.click();
    const nativeInput = document.querySelector('header #search-input');
    if (nativeInput) {
      nativeInput.value = input.value;
      nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInput.focus();
    }
  });
  return form;
}

function createAudience(heading, list) {
  const audience = createTag('section', { class: 'storefront-home__audience' });
  heading.classList.add('storefront-home__audience-title');
  const grid = createTag('div', { class: 'storefront-home__category-grid' });
  [...list.children].forEach((item) => {
    const link = item.querySelector('strong a');
    const links = item.querySelector('ul');
    const category = createTag('section', { class: 'storefront-home__category' });
    const title = createTag('h3', { class: 'storefront-home__category-title' });
    title.append(link);
    category.append(title, links);
    grid.append(category);
  });
  audience.append(heading, grid);
  return audience;
}

export default function decorate(block) {
  const cells = [...(block.firstElementChild?.children || [])];
  if (cells.length !== 7) return;
  const [titleCell, textCell, shortcutsCell, developerTitleCell, developerListCell,
    authorTitleCell, authorListCell] = cells;
  const title = titleCell.querySelector('h1');
  const description = textCell.querySelector('p') || createTag('p', {});
  const developerTitle = developerTitleCell.querySelector('h2');
  const authorTitle = authorTitleCell.querySelector('h2');
  const developerList = developerListCell.querySelector('ul');
  const authorList = authorListCell.querySelector('ul');
  if (!title || !textCell.textContent.trim() || !developerTitle || !authorTitle
    || !developerList || !authorList) return;
  const categories = [...developerList.children, ...authorList.children];
  if (categories.some((item) => !item.querySelector('strong a') || !item.querySelector('ul'))) {
    return;
  }

  if (!description.hasChildNodes()) description.append(...textCell.childNodes);
  const hero = createTag('section', { class: 'storefront-home__hero' });
  const eyebrow = createTag('p', { class: 'storefront-home__eyebrow' });
  eyebrow.textContent = 'Documentation';
  title.classList.add('storefront-home__title');
  const emphasis = 'storefronts on the web';
  const titleText = title.textContent.trim();
  if (titleText.endsWith(emphasis)) {
    const highlight = createTag('span', { class: 'storefront-home__highlight' });
    highlight.textContent = emphasis;
    title.replaceChildren(document.createTextNode(titleText.slice(0, -emphasis.length)), highlight);
  }
  description.classList.add('storefront-home__description');
  const shortcuts = createTag('nav', {
    class: 'storefront-home__shortcuts',
    'aria-label': 'Storefront documentation',
  });
  [...shortcutsCell.querySelectorAll('a')].forEach((link, index) => {
    link.classList.add('storefront-home__shortcut');
    if (SHORTCUT_ICONS[index]) link.prepend(createIcon(SHORTCUT_ICONS[index]));
    shortcuts.append(link);
  });
  hero.append(eyebrow, title, description, shortcuts, createSearch());

  const directory = createTag('div', { class: 'storefront-home__directory' });
  directory.append(
    createAudience(developerTitle, developerList),
    createAudience(authorTitle, authorList),
  );
  block.replaceChildren(hero, directory);
  block.classList.add('storefronthome');
  block.closest('main')?.classList.add('storefront-home-page');
  block.setAttribute('daa-lh', 'storefront-home');
}
