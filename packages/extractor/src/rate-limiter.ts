/**
 * Rate limiting utility for API calls
 */

import { CostLimitError } from './errors';
import { logger } from './logger';

export interface RateLimitOptions {
  maxRequestsPerMinute: number;
  maxCostPerSession: number;
}

/**
 * Simple token bucket rate limiter
 */
export class RateLimiter {
  private requestTimestamps: number[] = [];
  private totalCost: number = 0;
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = options;
  }

  /**
   * Wait if necessary to respect rate limits, then allow request
   */
  async checkAndWait(): Promise<void> {
    // Clean up old timestamps (older than 1 minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    // Check if we've hit the rate limit
    if (this.requestTimestamps.length >= this.options.maxRequestsPerMinute) {
      // Calculate how long to wait
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestTimestamp);

      if (waitTime > 0) {
        logger.warn('Rate limit reached, waiting', {
          waitTimeMs: waitTime,
          requestsInLastMinute: this.requestTimestamps.length
        });

        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Recursively check again after waiting
        return this.checkAndWait();
      }
    }

    // Record this request
    this.requestTimestamps.push(now);
  }

  /**
   * Add cost for a completed request
   */
  addCost(cost: number): void {
    this.totalCost += cost;

    logger.debug('API cost added', {
      requestCost: cost,
      totalCost: this.totalCost,
      maxCost: this.options.maxCostPerSession
    });

    // Check if we've exceeded cost limit
    if (this.totalCost > this.options.maxCostPerSession) {
      throw new CostLimitError(this.totalCost, this.options.maxCostPerSession);
    }
  }

  /**
   * Get current session cost
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Get request count in last minute
   */
  getRequestCount(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    return this.requestTimestamps.filter(ts => ts > oneMinuteAgo).length;
  }

  /**
   * Reset rate limiter (for new session)
   */
  reset(): void {
    this.requestTimestamps = [];
    this.totalCost = 0;
  }
}
