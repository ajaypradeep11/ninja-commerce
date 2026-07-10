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

// Regression: Next.js marks a route dynamic (e.g. because a Server Component
// fetch used `cache: 'no-store'`) by throwing a control-flow error carrying
// `digest: 'DYNAMIC_SERVER_USAGE'`. The generated hey-api client swallows any
// thrown error from the underlying fetch call and returns it as `{ error }`
// instead of rethrowing it, so `unwrap` must detect and rethrow this specific
// shape untouched rather than masking it as an ApiError — otherwise Next can
// no longer recognize it and `next build` fails instead of rendering the
// route dynamically.
test('rethrows a Next.js dynamic-server-usage control-flow error untouched (result.error path)', async () => {
  const dynamicError = Object.assign(new Error('Dynamic server usage: Route / ...'), {
    digest: 'DYNAMIC_SERVER_USAGE',
  });
  const call = Promise.resolve({ data: undefined, error: dynamicError, response: undefined });
  const err = await unwrap(call).catch((e) => e);
  expect(err).toBe(dynamicError);
});

test('rethrows a Next.js dynamic-server-usage control-flow error untouched (thrown path)', async () => {
  const dynamicError = Object.assign(new Error('Dynamic server usage: Route / ...'), {
    digest: 'DYNAMIC_SERVER_USAGE',
  });
  const err = await unwrap(Promise.reject(dynamicError)).catch((e) => e);
  expect(err).toBe(dynamicError);
});
