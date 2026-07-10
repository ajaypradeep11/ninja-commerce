export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface SdkResult<T> {
  data?: T;
  error?: unknown;
  response?: Response;
}

function messageFrom(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
  }
  return 'Something went wrong';
}

export async function unwrap<T>(call: Promise<SdkResult<T>>): Promise<T> {
  let result: SdkResult<T>;
  try {
    result = await call;
  } catch (cause) {
    throw new ApiError(
      0,
      cause instanceof Error ? cause.message : 'Network request failed',
    );
  }

  const { data, error, response } = result;
  if (error !== undefined) {
    throw new ApiError(response?.status ?? 0, messageFrom(error));
  }
  return data as T;
}
