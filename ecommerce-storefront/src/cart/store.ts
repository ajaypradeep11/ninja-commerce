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
let cartCurrency: 'CAD' | 'USD' | null = loadCurrency();
const EMPTY: CartLine[] = [];

function isValidLine(raw: unknown): raw is CartLine {
  if (typeof raw !== 'object' || raw === null) return false;
  const l = raw as Record<string, unknown>;
  return (
    typeof l.productId === 'string' &&
    typeof l.slug === 'string' &&
    typeof l.name === 'string' &&
    (typeof l.image === 'string' || l.image === null) &&
    Number.isInteger(l.priceCents) &&
    (l.priceCents as number) >= 0 &&
    Number.isInteger(l.quantity) &&
    (l.quantity as number) >= 1 &&
    (l.quantity as number) <= MAX_QTY
  );
}

function load(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '');
    if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { lines?: unknown }).lines)) {
      return (parsed as { lines: unknown[] }).lines.filter(isValidLine);
    }
  } catch {
    /* corrupted or absent — start empty */
  }
  return [];
}

function loadCurrency(): 'CAD' | 'USD' | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '');
    const raw = (parsed as { currency?: unknown })?.currency;
    return raw === 'CAD' || raw === 'USD' ? raw : null;
  } catch {
    return null;
  }
}

export function getCartCurrency(): 'CAD' | 'USD' | null {
  return typeof window === 'undefined' ? null : cartCurrency;
}

export function setCartCurrency(currency: 'CAD' | 'USD'): void {
  cartCurrency = currency;
  persist(lines);
}

function persist(next: CartLine[]) {
  lines = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify({ lines, currency: cartCurrency }));
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
  cartCurrency = null;
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
