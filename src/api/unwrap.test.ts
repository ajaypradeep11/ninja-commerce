import { unwrap, ApiError } from './unwrap';

test('returns data when no error', async () => {
  await expect(
    unwrap(
      Promise.resolve({ data: { ok: 1 }, error: undefined, response: new Response() }),
    ),
  ).resolves.toEqual({ ok: 1 });
});

test('throws ApiError with status and message', async () => {
  const call = Promise.resolve({
    data: undefined,
    error: { statusCode: 409, message: 'Only 3 left of Heavyweight Hoodie', error: 'Conflict' },
    response: new Response(null, { status: 409 }),
  });
  const err = await unwrap(call).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(409);
  expect(err.message).toBe('Only 3 left of Heavyweight Hoodie');
});

test('joins validation message arrays', async () => {
  const call = Promise.resolve({
    data: undefined,
    error: {
      statusCode: 400,
      message: ['rating must not be greater than 5', 'text must be a string'],
      error: 'Bad Request',
    },
    response: new Response(null, { status: 400 }),
  });
  const err = await unwrap(call).catch((e) => e);
  expect(err.message).toBe(
    'rating must not be greater than 5. text must be a string',
  );
});

test('network failure surfaces status 0', async () => {
  const err = await unwrap(Promise.reject(new TypeError('fetch failed'))).catch(
    (e) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(0);
});
