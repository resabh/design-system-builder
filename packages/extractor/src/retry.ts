/**
 * Retry utility with exponential backoff
 */

import { createLogger } from './logger';

const logger = createLogger('retry');

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  delayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoff?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Callback on retry attempt */
  onRetry?: (attempt: number, delay: number, error: Error) => void;
  /** Function to determine if error is retryable */
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoff: 2,
  maxDelayMs: 30000,
  onRetry: () => {},
  shouldRetry: () => true
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry this error
      if (!opts.shouldRetry(lastError)) {
        logger.debug('Error not retryable, throwing immediately', { error: lastError });
        throw lastError;
      }

      // If last attempt, throw the error
      if (attempt === opts.maxAttempts) {
        logger.error(`All ${opts.maxAttempts} retry attempts failed`, lastError);
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.delayMs * Math.pow(opts.backoff, attempt - 1),
        opts.maxDelayMs
      );

      // Call retry callback
      opts.onRetry(attempt, delay, lastError);
      logger.warn(
        `Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms`,
        { error: lastError.message }
      );

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is a network error (likely retryable)
 */
export function isNetworkError(error: Error): boolean {
  const networkErrorCodes = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH'
  ];

  const errorMessage = error.message.toLowerCase();
  const networkErrorMessages = [
    'network',
    'timeout',
    'timed out',
    'connection',
    'econnrefused',
    'econnreset'
  ];

  // Check error code
  if ('code' in error) {
    if (networkErrorCodes.includes((error as any).code)) {
      return true;
    }
  }

  // Check error message
  return networkErrorMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Check if error is a timeout error (retryable)
 */
export function isTimeoutError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    error.name === 'TimeoutError' ||
    error.name === 'AbortError'
  );
}

/**
 * Default retry predicate for network operations
 */
export function shouldRetryNetworkError(error: Error): boolean {
  return isNetworkError(error) || isTimeoutError(error);
}

/**
 * Retry options optimized for browser operations
 */
export const BROWSER_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 2000,
  backoff: 1.5,
  maxDelayMs: 10000,
  shouldRetry: (error: Error) => {
    // Retry on network errors and timeouts
    if (isNetworkError(error) || isTimeoutError(error)) {
      return true;
    }
    // Don't retry on invalid selector or element not found
    if (error.message.includes('selector') || error.message.includes('not found')) {
      return false;
    }
    return true;
  }
};

/**
 * Retry options optimized for API calls
 */
export const API_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  backoff: 2,
  maxDelayMs: 30000,
  shouldRetry: (error: Error) => {
    // Retry on network errors
    if (isNetworkError(error)) {
      return true;
    }
    // Retry on 5xx server errors
    if ('status' in error && typeof (error as any).status === 'number') {
      const status = (error as any).status;
      return status >= 500 && status < 600;
    }
    // Don't retry on 4xx client errors
    return false;
  }
};
