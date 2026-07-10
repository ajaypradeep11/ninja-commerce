import type { OrderResponseDto } from '@/api/generated';

export type PollForOrderResult = {
  state: 'paid' | 'pending-timeout' | 'not-found';
  order?: OrderResponseDto;
};

const PAID_STATUSES = new Set(['PAID', 'SHIPPED', 'DELIVERED']);

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Pure/injectable: takes a fetch function and an optional `sleep` so tests can
// run every poll attempt without waiting on real timers. Attempts are counted
// (Math.ceil(timeoutMs / intervalMs)) rather than measured against the wall
// clock, so a mocked `sleep` that resolves instantly still yields a bounded,
// deterministic number of polls instead of spinning forever.
export async function pollForOrder(
  fetchMine: () => Promise<OrderResponseDto[]>,
  sessionId: string,
  opts: { intervalMs: number; timeoutMs: number; sleep?: (ms: number) => Promise<void> },
): Promise<PollForOrderResult> {
  const sleep = opts.sleep ?? realSleep;
  const maxAttempts = Math.max(1, Math.ceil(opts.timeoutMs / opts.intervalMs));

  let lastMatch: OrderResponseDto | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const orders = await fetchMine();
    const match = orders.find((o) => o.stripeSessionId === sessionId);
    if (match) {
      lastMatch = match;
      if (PAID_STATUSES.has(match.status)) {
        return { state: 'paid', order: match };
      }
    }
    if (attempt < maxAttempts) {
      await sleep(opts.intervalMs);
    }
  }

  return lastMatch ? { state: 'pending-timeout', order: lastMatch } : { state: 'not-found' };
}
