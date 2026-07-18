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
  expect(JSON.parse(localStorage.getItem('localninja.cart.v1')!).lines).toHaveLength(1);
});

test('corrupted JSON yields empty cart', () => {
  localStorage.setItem('localninja.cart.v1', '{nope');
  expect(getLines()).toEqual([]);
});

test('drops invalid lines from localStorage, keeps valid ones', () => {
  const valid = { productId: 'p1', slug: 'tee', name: 'Tee', priceCents: 2900, image: null, quantity: 2, stockQty: 40 };
  const badQty = { ...valid, productId: 'p2', quantity: 0 };
  const overQty = { ...valid, productId: 'p3', quantity: 200 };
  const nanQty = { ...valid, productId: 'p4', quantity: NaN };
  const negPrice = { ...valid, productId: 'p5', priceCents: -5 };
  const nonIntPrice = { ...valid, productId: 'p6', priceCents: 12.5 };
  const badName = { ...valid, productId: 'p7', name: 42 };
  const badImage = { ...valid, productId: 'p8', image: 5 };
  localStorage.setItem(
    'localninja.cart.v1',
    JSON.stringify({ lines: [valid, badQty, overQty, nanQty, negPrice, nonIntPrice, badName, badImage] }),
  );
  window.dispatchEvent(new StorageEvent('storage', { key: 'localninja.cart.v1' }));
  const restored = getLines();
  expect(restored).toHaveLength(1);
  expect(restored[0].productId).toBe('p1');
});

test('subscribe notifies on mutation and unsubscribes', () => {
  const cb = vi.fn();
  const off = subscribe(cb);
  addLine(tee, 1);
  expect(cb).toHaveBeenCalled();
  off();
});
