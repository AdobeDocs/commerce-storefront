import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/blocks',
  outputDir: './node_modules/.cache/playwright-results',
});
