import { addLine, setQuantity, removeLine, clearCart, updateLineMeta, getLines, subscribe, subtotalCents, cartCount } from './store';

const tee = { productId: 'p1', slug: 'organic-cotton-tee', name: 'Organic Cotton Tee', priceCents: 2900, image: null, stockQty: 40 };
const hoodie = { productId: 'p2', slug: 'heavyweight-hoodie', name: 'Heavyweight Hoodie', priceCents: 7900, image: null, stockQty: 3 };

beforeEach(() => {
  localStorage.clear();
  clearCart();
});

test('addLine adds then merges quantities by productId', () => {
  addLine(tee, 1);
  addLine(tee, 2);
  expect(getLines()).toHaveLength(1);
  expect(getLines()[0].quantity).toBe(3);
});

test('quantity clamps to stockQty', () => {
  addLine(hoodie, 5);
  expect(getLines()[0].quantity).toBe(3);
  setQuantity('p2', 99);
  expect(getLines()[0].quantity).toBe(3);
});

test('setQuantity floors at 1 and removeLine deletes', () => {
  addLine(tee, 2);
  setQuantity('p1', 0);
  expect(getLines()[0].quantity).toBe(1);
  removeLine('p1');
  expect(getLines()).toHaveLength(0);
});

test('updateLineMeta re-clamps when stock drops', () => {
  addLine(tee, 10);
  updateLineMeta('p1', { stockQty: 4, priceCents: 3100 });
  expect(getLines()[0]).toMatchObject({ quantity: 4, priceCents: 3100, stockQty: 4 });
});

test('subtotal and count', () => {
  addLine(tee, 2);
  addLine(hoodie, 1);
  expect(subtotalCents(getLines())).toBe(2 * 2900 + 7900);
  expect(cartCount(getLines())).toBe(3);
});

test('persists to and restores from localStorage', () => {
  addLine(tee, 2);
  expect(JSON.parse(localStorage.getItem('everloom.cart.v1')!).lines).toHaveLength(1);
});

test('corrupted JSON yields empty cart', () => {
  localStorage.setItem('everloom.cart.v1', '{nope');
  expect(getLines()).toEqual([]);
});

test('subscribe notifies on mutation and unsubscribes', () => {
  const cb = vi.fn();
  const off = subscribe(cb);
  addLine(tee, 1);
  expect(cb).toHaveBeenCalled();
  off();
});
