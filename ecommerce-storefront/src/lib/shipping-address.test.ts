import { normalizeShippingAddress } from './shipping-address';

test('normalizes Stripe snake_case shape', () => {
  expect(
    normalizeShippingAddress({ name: 'Demo Buyer', line1: '1 Main St', city: 'Berlin', postal_code: '10115', country: 'DE' }),
  ).toEqual({ name: 'Demo Buyer', line1: '1 Main St', city: 'Berlin', postalCode: '10115', country: 'DE' });
});

test('passes through camelCase saved-address shape with optional fields', () => {
  expect(
    normalizeShippingAddress({ label: 'Home', line1: '2 High St', line2: 'Flat 3', city: 'London', state: '', postalCode: 'N1 9GU', country: 'GB' }),
  ).toMatchObject({ line1: '2 High St', line2: 'Flat 3', postalCode: 'N1 9GU' });
});

test.each([null, undefined, 42, 'x', {}, { city: 'Nowhere' }])('malformed input %p → null', (input) => {
  expect(normalizeShippingAddress(input)).toBeNull();
});
