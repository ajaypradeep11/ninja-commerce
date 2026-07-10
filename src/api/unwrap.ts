export interface ApiError {
  status: number;
  message: string;
}

interface SdkResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

function messageFrom(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return 'Something went wrong';
}

export async function unwrap<T>(call: Promise<SdkResult<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (error !== undefined) {
    const apiError: ApiError = {
      status: response.status,
      message: messageFrom(error),
    };
    throw apiError;
  }
  return data as T;
}
