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

The homepage uses the `Cards` component's `storefront-home` variant to render
the introduction, navigation shortcuts, search, and developer/author grids.
Its seven slots consume one heading, one description, the primary link list,
and a heading plus nested category list for each audience.

This variant depends on the companion `adp-devsite` renderer's Cards dispatch
and `storefronthome` block. Deploy those frontend changes before publishing
the updated homepage; a fresh upstream clone does not include the local block.
Search opens the existing devsite search dialog with the submitted query.

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
