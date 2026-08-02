export type SyncQueryError = {
  message?: string;
  code?: string;
  status?: number | string;
  statusCode?: number | string;
};

type RetryOptions = {
  maxAttempts?: number;
  timeoutMs?: number;
  wait?: (duration: number) => Promise<void>;
  random?: () => number;
  warn?: (message: string) => void;
};

const defaultWait = (duration: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, duration));

export function isTransientSyncError(error: unknown): boolean {
  const candidate = (error ?? {}) as SyncQueryError;
  const message = `${candidate.message ?? error ?? ''}`.toLowerCase();
  const looksLikeTransportFailure = message.includes('network')
    || message.includes('fetch')
    || message.includes('timeout')
    || message.includes('timed out')
    || message.includes('abort')
    || message.includes('connection')
    || message.includes('offline');
  // PostgREST reports an explicitly aborted fetch with HTTP status 400, so
  // transport wording must take precedence over status classification.
  if (looksLikeTransportFailure) return true;

  const rawStatus = candidate.status ?? candidate.statusCode;
  const status = rawStatus === undefined ? Number.NaN : Number(rawStatus);
  if (Number.isFinite(status)) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }
  return false;
}

export function toSyncError(error: unknown): Error {
  if (error instanceof Error) return error;
  const candidate = (error ?? {}) as SyncQueryError;
  const converted = new Error(candidate.message || candidate.code || 'Cloud request failed');
  Object.assign(converted, {
    code: candidate.code,
    status: candidate.status,
    statusCode: candidate.statusCode,
  });
  return converted;
}

/** Run an abortable Supabase query with bounded transient-error retries. */
export async function runSyncQuery<T>(
  label: string,
  operation: (signal: AbortSignal) => PromiseLike<{
    data: T | null;
    error: unknown;
    status?: number;
    statusText?: string;
  }>,
  options: RetryOptions = {},
): Promise<T | null> {
  const maxAttempts = options.maxAttempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const wait = options.wait ?? defaultWait;
  const random = options.random ?? Math.random;
  const warn = options.warn ?? ((message: string) => console.warn(message));
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { data, error, status, statusText } = await operation(controller.signal);
      if (!error) return data;
      const classifiedError = withResponseStatus(error, status, statusText);
      lastError = classifiedError;
      if (!isTransientSyncError(classifiedError) || attempt === maxAttempts - 1) {
        throw toSyncError(classifiedError);
      }
    } catch (error) {
      lastError = error;
      if (!isTransientSyncError(error) || attempt === maxAttempts - 1) {
        throw toSyncError(error);
      }
    } finally {
      clearTimeout(timeout);
    }

    const delay = 300 * (2 ** attempt) + Math.floor(random() * 200);
    warn(`[sync] ${label} temporarily failed; retrying in ${delay}ms`);
    await wait(delay);
  }

  throw toSyncError(lastError);
}

function withResponseStatus(
  error: unknown,
  status: number | undefined,
  statusText: string | undefined,
): unknown {
  if (status === undefined) return error;
  if (error instanceof Error) {
    Object.assign(error, { status, statusText });
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    return { ...error, status, statusText };
  }
  return { message: `${error ?? statusText ?? 'Cloud request failed'}`, status, statusText };
}
