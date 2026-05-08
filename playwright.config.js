require('dotenv').config({ path: '.env.test' });

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  globalTimeout: 600_000,
  workers: 1, // séquentiel — base Firebase partagée
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://floriancheval.github.io/Idea-ranker',
    headless: true,
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
