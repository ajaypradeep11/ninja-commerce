import { defineConfig, devices } from '@playwright/test';

// Consumes an already-running stack (Postgres, API :3002 seeded, Firebase
// Auth emulator :9098, `next dev`) — this config intentionally has no
// `webServer` block. Start the app yourself first, e.g.:
//   PORT=3005 npm run dev
//   BASE_URL=http://localhost:3005 npm run e2e
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false, // auth flows share the Firebase Auth emulator
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
