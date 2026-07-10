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

// Next.js signals internal control-flow (e.g. bailing a statically-eligible
// route into dynamic rendering because a fetch used `cache: 'no-store'`) by
// throwing a special error carrying `digest: 'DYNAMIC_SERVER_USAGE'`. The
// generated hey-api client's fetch wrapper catches *any* thrown error —
// including this one — and returns it as `{ error }` instead of rethrowing
// (see client.gen.ts's `catch (error)` block). If we then mask that as an
// ApiError, Next can no longer recognize it and the build fails instead of
// treating the route as dynamic. Detect and rethrow it untouched.
function isNextControlFlowError(value: unknown): value is { digest: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'digest' in value &&
    typeof (value as { digest: unknown }).digest === 'string' &&
    (value as { digest: string }).digest.startsWith('DYNAMIC_SERVER_USAGE')
  );
}

export async function unwrap<T>(call: Promise<SdkResult<T>>): Promise<T> {
  let result: SdkResult<T>;
  try {
    result = await call;
  } catch (cause) {
    if (isNextControlFlowError(cause)) throw cause;
    throw new ApiError(
      0,
      cause instanceof Error ? cause.message : 'Network request failed',
    );
  }

  const { data, error, response } = result;
  if (error !== undefined) {
    if (isNextControlFlowError(error)) throw error;
    throw new ApiError(response?.status ?? 0, messageFrom(error));
  }
  return data as T;
}
