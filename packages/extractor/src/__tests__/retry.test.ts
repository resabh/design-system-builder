/**
 * Tests for retry utility
 */

import { withRetry, isNetworkError, isTimeoutError, shouldRetryNetworkError } from '../retry';

describe('withRetry', () => {
  it('should return result on first attempt if successful', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

    await expect(
      withRetry(fn, { maxAttempts: 3, delayMs: 10 })
    ).rejects.toThrow('Always fails');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect shouldRetry predicate', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Not retryable'));

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        delayMs: 10,
        shouldRetry: () => false
      })
    ).rejects.toThrow('Not retryable');

    // Should only be called once since it's not retryable
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue('success');

    const onRetry = jest.fn();

    await withRetry(fn, {
      maxAttempts: 2,
      delayMs: 10,
      onRetry
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      1, // attempt
      expect.any(Number), // delay
      expect.any(Error) // error
    );
  });

  it('should apply exponential backoff', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const delays: number[] = [];
    await withRetry(fn, {
      maxAttempts: 3,
      delayMs: 100,
      backoff: 2,
      onRetry: (_, delay) => delays.push(delay)
    });

    expect(delays).toHaveLength(2);
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);
  });

  it('should respect maxDelayMs', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const delays: number[] = [];
    await withRetry(fn, {
      maxAttempts: 3,
      delayMs: 1000,
      backoff: 2,
      maxDelayMs: 1500,
      onRetry: (_, delay) => delays.push(delay)
    });

    expect(delays).toHaveLength(2);
    expect(delays[0]).toBeLessThanOrEqual(1500);
    expect(delays[1]).toBeLessThanOrEqual(1500);
  }, 10000); // Increase timeout to 10s
});

describe('isNetworkError', () => {
  it('should detect ECONNREFUSED error', () => {
    const error: any = new Error('Connection refused');
    error.code = 'ECONNREFUSED';
    expect(isNetworkError(error)).toBe(true);
  });

  it('should detect ETIMEDOUT error', () => {
    const error: any = new Error('Timeout');
    error.code = 'ETIMEDOUT';
    expect(isNetworkError(error)).toBe(true);
  });

  it('should detect network error from message', () => {
    const error = new Error('network request failed');
    expect(isNetworkError(error)).toBe(true);
  });

  it('should detect timeout error from message', () => {
    const error = new Error('Request timed out');
    expect(isNetworkError(error)).toBe(true);
  });

  it('should not detect non-network errors', () => {
    const error = new Error('Something else went wrong');
    expect(isNetworkError(error)).toBe(false);
  });
});

describe('isTimeoutError', () => {
  it('should detect timeout in message', () => {
    const error = new Error('Request timeout');
    expect(isTimeoutError(error)).toBe(true);
  });

  it('should detect TimeoutError name', () => {
    const error = new Error('Failed');
    error.name = 'TimeoutError';
    expect(isTimeoutError(error)).toBe(true);
  });

  it('should detect AbortError name', () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    expect(isTimeoutError(error)).toBe(true);
  });

  it('should not detect non-timeout errors', () => {
    const error = new Error('Invalid input');
    expect(isTimeoutError(error)).toBe(false);
  });
});

describe('shouldRetryNetworkError', () => {
  it('should retry on network errors', () => {
    const error: any = new Error('Network failed');
    error.code = 'ECONNREFUSED';
    expect(shouldRetryNetworkError(error)).toBe(true);
  });

  it('should retry on timeout errors', () => {
    const error = new Error('Timeout');
    error.name = 'TimeoutError';
    expect(shouldRetryNetworkError(error)).toBe(true);
  });

  it('should not retry on other errors', () => {
    const error = new Error('Invalid data');
    expect(shouldRetryNetworkError(error)).toBe(false);
  });
});
