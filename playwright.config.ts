import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const localChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const hasLocalChrome = fs.existsSync(localChromePath)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4273',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(hasLocalChrome ? { launchOptions: { executablePath: localChromePath } } : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4273 --strictPort',
    url: 'http://127.0.0.1:4273',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
