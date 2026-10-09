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
Its seven slots consume one heading, one description, the primary link list,
and a heading plus nested category list for each audience.

The assets live under `src/pages/blocks/storefronthome/`, with their paths
registered in `src/pages/blocks/blocks.json`. The homepage opts in with
`projectBlocks: blocks/project-blocks.js` in its frontmatter. This points to
the project-owned resolver, not the JSON manifest. The resolver reads the
manifest once and returns registered block assets. Asset paths resolve relative
to the manifest and must remain on the same origin within this project's path
prefix. Unregistered blocks continue using the shared renderer.

Deploy the companion `adp-devsite` project-block loader and
`devsite-runtime-connector` metadata and asset content-type support before
publishing the updated homepage. After that one-time integration, block changes
can be maintained here without modifying shared Cards.
Search opens the existing devsite search dialog with the submitted query.

Run `npm run test:blocks` to test the project-owned block.
After installing dependencies for the first time, run
`npx playwright install chromium --only-shell` to install its test browser.

## Project-Owned Loader Contract

The only required frontend change in `adp-devsite` is a generic hook in
`lib-helix.js`. It imports the module identified by the page's `project-blocks`
metadata and calls its default export with the block name. The module returns
an object containing absolute `js` and `css` URLs, or `null` to use shared
assets. Missing or broken project loaders also fall back to shared assets.
The hook validates the loader and returned assets against the same origin,
the page's `pathprefix`, and the expected file extensions.

Maintain the resolver, its manifest, block implementation, fonts, and tests in
this repository. Register additional blocks in `src/pages/blocks/blocks.json`
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
