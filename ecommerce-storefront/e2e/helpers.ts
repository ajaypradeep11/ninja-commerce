import type { Page, TestInfo } from '@playwright/test';

// Fine to build in Node at test time (not a workflow/edge script) — gives
// each worker/repeat a distinct, collision-free address against the shared
// Firebase Auth emulator.
export function uniqueEmail(testInfo: TestInfo): string {
  return `shopper+${testInfo.workerIndex}-${testInfo.repeatEachIndex}-${Date.now()}@example.com`;
}

// Next's dev-mode streaming SSR (React 19 Suspense swap) can momentarily
// leave a second, `hidden` copy of a just-resolved segment's DOM in place
// alongside the real one while the client-side `$RC` swap script runs. A
// bare page.getByText() occasionally catches both and trips Playwright's
// strict-mode check. Scoping to visible elements only sidesteps the race
// without weakening the assertion (retries: 0, so we can't just retry it).
export function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}
