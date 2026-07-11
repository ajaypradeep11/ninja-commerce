export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  image: string | null;
  quantity: number;
  stockQty: number;
};

const KEY = 'localninja.cart.v1';
const MAX_QTY = 99;
const listeners = new Set<() => void>();
let lines: CartLine[] = load();
const EMPTY: CartLine[] = [];

function load(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '');
    if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { lines?: unknown }).lines)) {
      return (parsed as { lines: CartLine[] }).lines;
    }
  } catch {
    /* corrupted or absent — start empty */
  }
  return [];
}

function persist(next: CartLine[]) {
  lines = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify({ lines }));
  }
  listeners.forEach((l) => l());
}

const clamp = (qty: number, stockQty: number) => Math.max(1, Math.min(qty, stockQty, MAX_QTY));

export function addLine(line: Omit<CartLine, 'quantity'>, qty: number): void {
  const existing = lines.find((l) => l.productId === line.productId);
  const next = existing
    ? lines.map((l) =>
        l.productId === line.productId
          ? { ...l, ...line, quantity: clamp(l.quantity + qty, line.stockQty) }
          : l,
      )
    : [...lines, { ...line, quantity: clamp(qty, line.stockQty) }];
  persist(next);
}

export function setQuantity(productId: string, qty: number): void {
  persist(lines.map((l) => (l.productId === productId ? { ...l, quantity: clamp(qty, l.stockQty) } : l)));
}

export function removeLine(productId: string): void {
  persist(lines.filter((l) => l.productId !== productId));
}

export function clearCart(): void {
  persist([]);
}

export function updateLineMeta(
  productId: string,
  patch: Partial<Pick<CartLine, 'priceCents' | 'stockQty' | 'name' | 'image'>>,
): void {
  persist(
    lines.map((l) =>
      l.productId === productId
        ? { ...l, ...patch, quantity: clamp(l.quantity, patch.stockQty ?? l.stockQty) }
        : l,
    ),
  );
}

export function getLines(): CartLine[] {
  return typeof window === 'undefined' ? EMPTY : lines;
}

export function getServerLines(): CartLine[] {
  return EMPTY;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      lines = load();
      listeners.forEach((l) => l());
    }
  });
}

export const subtotalCents = (ls: CartLine[]) => ls.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
export const cartCount = (ls: CartLine[]) => ls.reduce((sum, l) => sum + l.quantity, 0);
