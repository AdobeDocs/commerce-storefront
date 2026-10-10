# Adobe Commerce Storefront Documentation

Please see the [ADP Developer Site Documentation](https://developer-stage.adobe.com/dev-docs-reference/).

## Migration Source

Content is being migrated from
[commerce-docs/microsite-commerce-storefront](https://github.com/commerce-docs/microsite-commerce-storefront/tree/release).
Its default branch is `release`, and documentation lives in `src/content/docs/`.

This repository uses Adobe's documentation renderer, not the source site's
Astro/Starlight frontend. Add migrated Markdown pages under `src/pages/` and
register them in `src/pages/config.md`. Convert MDX components and update links
and asset paths for the destination renderer; do not copy the old frontend's
build, theme, or deployment configuration.

The Analytics demo pages, dummy guides, sample API specification, and template
contributor records have been removed. Navigation contains only the Storefront
homepage until real pages are migrated. The local preview, Adobe deployment
and lint workflows, license, and repository contribution policies are retained.

## Homepage Layout

The homepage uses the project-owned `StorefrontHome` component to render
the introduction, navigation shortcuts, search, and developer/author grids.
Its fixed `heading` slot takes the first included section heading. The renderer reads
the following ordinary Markdown document, finding sections and fields by name.
It stops at another page section or an unrelated block.

Edit all page copy and links in [src/pages/index.md](src/pages/index.md).
Use `##` for the five sections and `###` for category headings. Hyphens are only
needed for actual link lists; no asterisks or nested structural lists are required.

| Section | What It Controls |
| --- | --- |
| Hero | The small label, headline, blue highlight, and introductory paragraph |
| Shortcuts | The row of navigation buttons |
| Search | The search field's label and placeholder |
| Developers | The developer directory, shown first on mobile |
| Authors | The author directory, shown below developers on mobile |

All five sections are optional. To omit an area, delete its `##` heading and
everything beneath it up to the next `##` heading. For example, removing
`## Search` and its `Label:` paragraph removes the homepage search form; the
site header's search remains available. No JavaScript or CSS edits are needed.
With one audience, the directory fills the available width without a divider.
With neither audience, no directory is rendered. Omitted areas leave no empty
containers. Keep at least one section when using `StorefrontHome`.

An included section must still be complete: Hero needs `Eyebrow`, `Headline`,
and `Description`; Search needs a nonempty `Label`; Shortcuts needs links;
and each audience needs a `Heading` plus category headings with nonempty link
lists. Empty or malformed included sections leave the source content untouched
rather than rendering a partial page.

To change text, edit the words after the colon. Keep the section names and field
labels unchanged. `Highlight` is optional; omit it for a single-color headline.
Write each field as a separate paragraph, with a blank line between fields.

```markdown
## Hero

Eyebrow: Documentation

Headline: Create the fastest

Highlight: storefronts on the web

Description: Learn to build Adobe Commerce storefronts.

## Developers

Heading: [For developers](https://experienceleague.adobe.com/en/tools/commerce-storefront/get-started/)

### Getting started

- [Prerequisites](https://experienceleague.adobe.com/en/tools/commerce-storefront/get-started/before-you-start/)
```

To change a link, edit `[visible text](URL)`. To add a category, add a `###`
heading followed by a link list. Category titles can be plain words or links.
To add a link, add another `- [visible text](URL)` line to that list. Keep the
frontmatter and `<StorefrontHome slots="heading" />` setup unchanged, with
the first included section's `##` heading immediately after the component marker.

Edit the main layout in `PAGE_TEMPLATE` in
[src/pages/blocks/storefronthome/storefronthome.js](src/pages/blocks/storefronthome/storefronthome.js),
and styling in
[src/pages/blocks/storefronthome/storefronthome.css](src/pages/blocks/storefronthome/storefronthome.css).

The shared linter's fixed component allowlist does not include `StorefrontHome`.
[package.json](package.json) scopes a `no-html-tags` exception to
[src/pages/index.md](src/pages/index.md). This disables HTML-tag validation for
that page only; all other lint rules and pages remain checked.

The assets live under `src/pages/blocks/storefronthome/`, with their paths
registered in `static/blocks/blocks.json`. The homepage opts in with
`projectBlocks: blocks/project-blocks.js` in its frontmatter. This points to
the project-owned resolver, not the JSON manifest. The resolver reads the
manifest once and returns registered block assets. Asset paths resolve relative
to the manifest and must remain on the same origin within this project's path
prefix. Unregistered blocks continue using the shared renderer. The preview proxy
serves the static manifest at `/commerce/storefront/blocks/blocks.json`.

Deploy the companion `adp-devsite` project-block loader and
`devsite-runtime-connector` metadata and asset content-type support before
publishing the updated homepage. After that one-time integration, block changes
can be maintained here without modifying shared Cards.
Search opens the existing devsite search dialog with the submitted query.

Run `npm run test:blocks` to test the project-owned block.
After installing dependencies for the first time, run
`npx playwright install chromium --only-shell` to install its test browser.

### CSS Selector Map

Markdown supplies the content, but CSS targets the HTML produced by
[storefronthome.js](src/pages/blocks/storefronthome/storefronthome.js).
`PAGE_TEMPLATE` defines the main structure; `renderPage` and `createAudience`
add the headline, shortcuts, audience sections, and categories. The
`storefront-home__` classes are project-owned names, not Markdown keywords.

The selectors below identify elements. Keep the existing stylesheet's `main`
and `.storefronthome` prefixes when editing rules so changes stay scoped to
this page and can override shared DevDocs styles.

| Page Element | Selector | What to Style |
| --- | --- | --- |
| Entire homepage block | `.storefronthome` | Shared color variables and text defaults |
| Hero band | `.storefront-home__hero` | Background, padding, and alignment |
| Small label above the headline | `.storefront-home__eyebrow` | Color, uppercase text, and spacing |
| Main headline | `.storefront-home__title` | Font size, weight, line height, and maximum width |
| Optional highlighted headline text | `.storefront-home__highlight` | Highlight color and separate-line display |
| Introductory paragraph | `.storefront-home__description` | Readable width, font size, and balanced wrapping |
| Shortcut row | `.storefront-home__shortcuts` | Flex layout, wrapping, and gaps |
| Individual shortcut link | `.storefront-home__shortcut` | Button-like appearance and hover state |
| Shortcut and search icons | `.storefront-home__icon` | Icon dimensions and alignment |
| Search form | `.storefront-home__search` | Width, border, background, and focus outline |
| Search label | `.storefront-home__search-label` | Visually hidden accessible label; do not use `display: none` |
| Search controls | `.storefront-home__search input`, `.storefront-home__search button` | Control sizing, padding, and typography |
| Developer and author directory | `.storefront-home__directory` | Audience columns, maximum width, and outer spacing |
| One audience section | `.storefront-home__audience` | Section sizing and divider between audiences |
| Audience heading | `.storefront-home__audience-title` | Heading typography and spacing |
| Categories within an audience | `.storefront-home__category-grid` | Category columns and gaps |
| One category | `.storefront-home__category` | Scope for its list, list items, and links |
| Category heading | `.storefront-home__category-title` | Heading typography and linked-title appearance |

DevDocs also adds surrounding HTML that is not in `PAGE_TEMPLATE`. These
selectors handle integration with its default page layout:

| Selector | Purpose |
| --- | --- |
| `main.storefront-home-page` | Page-level styling scope added by the renderer |
| `main.dev-docs.storefront-home-page.no-sidenav.no-aside > .section.grid-main-area` | Remove the shared width limit and side padding for the full-width hero |
| `.storefronthome-wrapper` | Remove shared block-wrapper padding and fill the available width |
| `main.storefront-home-page .content-header.no-breadcrumbs:not(:has(a, button))` | Hide the empty content header without hiding one that contains links or buttons |

### Styling Workflow

1. Start with a reference design or an explicit visual goal. HTML tells you
  what exists; it does not prescribe colors, spacing, or font sizes.
2. Open the local preview in a browser and inspect the element in DevTools.
  Use **Styles** to find matching and overridden rules, and **Computed** to
  see the final values. Inspect parent wrappers when width or padding seems wrong.
3. Try a small change in DevTools, then apply it to the existing rule in
  [storefronthome.css](src/pages/blocks/storefronthome/storefronthome.css).
  DevTools experiments are temporary and do not update the file.
4. Check wide and narrow screens, long text, hover, and keyboard focus.
  At widths of 760px or less, audiences stack; at 480px or less, categories
  also become a single column. Keep focus indicators and accessible labels intact.
5. Run `npm run test:blocks` after stylesheet changes to check the existing
  behavior and layout coverage. Browser inspection is still needed for visual changes.

## Project-Owned Loader Contract

The only required frontend change in `adp-devsite` is a generic hook in
`lib-helix.js`. It imports the module identified by the page's `project-blocks`
metadata and calls its default export with the block name. The module returns
an object containing absolute `js` and `css` URLs, or `null` to use shared
assets. Missing or broken project loaders also fall back to shared assets.
The hook validates the loader and returned assets against the same origin,
the page's `pathprefix`, and the expected file extensions.

Maintain the resolver, its manifest, block implementation, fonts, and tests in
this repository. Register additional blocks in `static/blocks/blocks.json`
and opt in each page using the same `projectBlocks` frontmatter. No per-block
change to `adp-devsite` is required. Resolver and shared-hook contract tests
are included in `npm run test:blocks` and use the sibling `adp-devsite` runtime.

## Local Preview

After opening this repository in VS Code, run:

```bash
npm run preview
```

The launcher starts the required services and opens <http://localhost:3000/commerce/storefront/>
in your browser when ready.
Keep the terminal running. Press Ctrl+C to stop services started by this command.
Already-running services are reused and left running when the command stops.
`npm run dev` still starts only the content server.

The local frontend proxy is `scripts/preview-server.mjs` in this repository;
the launcher no longer uses the companion repo's `dev.mjs`. It forwards this
site's documentation and block assets to the connector and shared assets to
the AEM dev server. Run `npm run test:preview` to check proxy routing, response
headers, binary font delivery, and shared runtime injection.

### One-Time Setup

Use Node 24.11 or newer within Node 24, and keep the companion repositories
beside this repository. If they are not installed yet, run:

```bash
git clone https://github.com/AdobeDocs/adp-devsite.git ../adp-devsite
git clone https://github.com/aemsites/devsite-runtime-connector.git ../devsite-runtime-connector
npm install --prefix ../adp-devsite
npm install --prefix ../devsite-runtime-connector
npm install
```

Do not repeat the clone commands for repositories that already exist.
