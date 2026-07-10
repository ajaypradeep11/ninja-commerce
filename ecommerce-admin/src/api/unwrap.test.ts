import { unwrap, type ApiError } from './unwrap';

function res(status: number): Response {
  return { status } as Response;
}

describe('unwrap', () => {
  it('returns data on success', async () => {
    await expect(
      unwrap(Promise.resolve({ data: { ok: 1 }, response: res(200) })),
    ).resolves.toEqual({ ok: 1 });
  });

  it('throws ApiError with the API message string', async () => {
    const err = unwrap(
      Promise.resolve({
        error: { statusCode: 409, message: 'Insufficient stock' },
        response: res(409),
      }),
    );
    await expect(err).rejects.toMatchObject({
      status: 409,
      message: 'Insufficient stock',
    } satisfies Partial<ApiError>);
  });

  it('joins array messages (class-validator style)', async () => {
    const err = unwrap(
      Promise.resolve({
        error: { statusCode: 400, message: ['name too short', 'slug invalid'] },
        response: res(400),
      }),
    );
    await expect(err).rejects.toMatchObject({
      status: 400,
      message: 'name too short, slug invalid',
    });
  });

  it('falls back to a generic message', async () => {
    const err = unwrap(Promise.resolve({ error: 'boom', response: res(500) }));
    await expect(err).rejects.toMatchObject({
      status: 500,
      message: 'Something went wrong',
    });
  });
});
