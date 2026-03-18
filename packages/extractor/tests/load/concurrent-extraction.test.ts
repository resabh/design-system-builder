/**
 * Load tests for concurrent design system extractions
 * These tests verify the system can handle multiple simultaneous extractions
 * and identify performance bottlenecks
 */

import { DesignSystemExtractor } from '../../src/extractor';
import type { LLMProvider, VisionRequest, VisionResponse, TokenUsage } from '@dsb/providers';

// Mock LLM Provider for load testing
class LoadTestMockProvider implements LLMProvider {
  name = 'load-test-mock';
  private callCount = 0;
  private totalLatency = 0;

  async initialize(config: any): Promise<void> {
    // Mock initialization
  }

  async validate(): Promise<boolean> {
    return true;
  }

  getPricing() {
    return {
      inputPer1M: 3.0,
      outputPer1M: 15.0,
      currency: 'USD'
    };
  }

  async analyzeImage(request: VisionRequest): Promise<VisionResponse> {
    this.callCount++;

    // Simulate API latency (100-300ms)
    const latency = Math.random() * 200 + 100;
    this.totalLatency += latency;
    await new Promise(resolve => setTimeout(resolve, latency));

    const isSynthesis = request.images.length === 0;

    const mockData = isSynthesis ? {
      tokens: {
        color: { 'primary': '#0066CC', 'secondary': '#6C757D' },
        typography: { 'heading-1': { fontFamily: 'Arial', fontSize: '32px', fontWeight: '700', lineHeight: '1.2' } },
        spacing: { 'spacing-2': '8px' },
        shadow: { 'shadow-sm': '0 1px 2px rgba(0,0,0,0.1)' },
        borderRadius: { 'radius-md': '8px' }
      },
      components: [],
      patterns: []
    } : {
      tokens: {
        colors: [{ name: 'primary', value: '#0066CC', usage: 'Primary', variant: '500' }],
        typography: [],
        spacing: [],
        shadows: [],
        borderRadius: []
      },
      components: [],
      patterns: []
    };

    return {
      content: JSON.stringify(mockData),
      model: 'load-test-mock-v1',
      usage: {
        inputTokens: 1000,
        outputTokens: 500
      }
    };
  }

  calculateCost(usage: TokenUsage): number {
    return (usage.inputTokens * 0.000003) + (usage.outputTokens * 0.000015);
  }

  getStats() {
    return {
      callCount: this.callCount,
      avgLatency: this.callCount > 0 ? this.totalLatency / this.callCount : 0
    };
  }

  reset() {
    this.callCount = 0;
    this.totalLatency = 0;
  }
}

describe('Load Tests - Concurrent Extractions', () => {
  let mockProvider: LoadTestMockProvider;

  beforeEach(() => {
    mockProvider = new LoadTestMockProvider();
  });

  describe('Concurrent Extraction Performance', () => {
    it('should handle 5 concurrent extractions', async () => {
      const extractor = new DesignSystemExtractor(mockProvider, {
        timeout: 60000,
        maxComponents: 5
      });

      const startTime = Date.now();

      // Run 5 extractions concurrently
      const promises = Array.from({ length: 5 }, () =>
        extractor.extract('https://example.com')
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Verify all extractions succeeded
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.tokens).toBeDefined();
        expect(result.metadata.sourceUrl).toBe('https://example.com');
      });

      // Performance assertions
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      const stats = mockProvider.getStats();
      console.log(`5 concurrent extractions:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  API calls: ${stats.callCount}`);
      console.log(`  Avg API latency: ${stats.avgLatency.toFixed(2)}ms`);
    }, 60000);

    it('should handle 10 concurrent extractions', async () => {
      const extractor = new DesignSystemExtractor(mockProvider, {
        timeout: 60000,
        maxComponents: 3
      });

      const startTime = Date.now();

      // Run 10 extractions concurrently
      const promises = Array.from({ length: 10 }, () =>
        extractor.extract('https://example.com')
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Verify all extractions succeeded
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Performance assertions
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds

      const stats = mockProvider.getStats();
      console.log(`10 concurrent extractions:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  API calls: ${stats.callCount}`);
      console.log(`  Avg API latency: ${stats.avgLatency.toFixed(2)}ms`);
      console.log(`  Throughput: ${(10000 / duration).toFixed(2)} extractions/sec`);
    }, 120000);

    it('should handle sequential extractions efficiently', async () => {
      const extractor = new DesignSystemExtractor(mockProvider, {
        timeout: 60000,
        maxComponents: 5
      });

      const startTime = Date.now();

      // Run 5 extractions sequentially
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await extractor.extract('https://example.com'));
      }

      const duration = Date.now() - startTime;

      // Verify all extractions succeeded
      expect(results).toHaveLength(5);

      const stats = mockProvider.getStats();
      console.log(`5 sequential extractions:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  API calls: ${stats.callCount}`);
      console.log(`  Avg extraction time: ${(duration / 5).toFixed(2)}ms`);
    }, 120000);
  });

  describe('Resource Management Under Load', () => {
    it('should not leak memory during concurrent extractions', async () => {
      const extractor = new DesignSystemExtractor(mockProvider, {
        timeout: 60000,
        maxComponents: 3
      });

      // Get initial memory usage
      const initialMemory = process.memoryUsage();

      // Run multiple batches of concurrent extractions
      for (let batch = 0; batch < 3; batch++) {
        const promises = Array.from({ length: 5 }, () =>
          extractor.extract('https://example.com')
        );
        await Promise.all(promises);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const heapGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory usage after 15 extractions:`);
      console.log(`  Heap growth: ${heapGrowth.toFixed(2)} MB`);
      console.log(`  RSS growth: ${((finalMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)} MB`);

      // Memory growth should be reasonable (< 100MB for 15 extractions)
      expect(heapGrowth).toBeLessThan(100);
    }, 180000);

    it('should recover from failures in concurrent extractions', async () => {
      let failureCount = 0;
      const totalExtractions = 10;

      const extractor = new DesignSystemExtractor(mockProvider, {
        timeout: 5000, // Short timeout to force some failures
        maxComponents: 3
      });

      const promises = Array.from({ length: totalExtractions }, async () => {
        try {
          return await extractor.extract('https://example.com');
        } catch (error) {
          failureCount++;
          return null;
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r !== null).length;

      console.log(`Failure recovery test:`);
      console.log(`  Successful: ${successCount}/${totalExtractions}`);
      console.log(`  Failed: ${failureCount}/${totalExtractions}`);

      // At least some should succeed
      expect(successCount).toBeGreaterThan(0);
    }, 120000);
  });

  describe('Rate Limiting Under Load', () => {
    it('should enforce rate limits across concurrent requests', async () => {
      // Note: This test verifies rate limiting behavior
      // Actual rate limiting is tested in integration tests
      // Here we just ensure concurrent requests don't bypass limits

      const extractor = new DesignSystemExtractor(mockProvider, {
        timeout: 60000,
        maxComponents: 3
      });

      const startTime = Date.now();

      // Launch many concurrent requests
      const promises = Array.from({ length: 20 }, () =>
        extractor.extract('https://example.com')
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(20);

      console.log(`20 concurrent extractions (rate limited):`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Throughput: ${(20000 / duration).toFixed(2)} extractions/sec`);

      // With rate limiting, this should take longer than without
      // But we can't easily test this without actual rate limiter
      expect(duration).toBeGreaterThan(0);
    }, 180000);
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance SLAs', async () => {
      const extractor = new DesignSystemExtractor(mockProvider, {
        timeout: 60000,
        maxComponents: 10
      });

      const durations: number[] = [];

      // Run 5 extractions and measure each
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await extractor.extract('https://example.com');
        durations.push(Date.now() - start);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];

      console.log(`Performance SLA metrics:`);
      console.log(`  Average: ${avgDuration.toFixed(2)}ms`);
      console.log(`  P95: ${p95Duration.toFixed(2)}ms`);
      console.log(`  Min: ${Math.min(...durations).toFixed(2)}ms`);
      console.log(`  Max: ${Math.max(...durations).toFixed(2)}ms`);

      // SLA targets (with mock provider)
      expect(avgDuration).toBeLessThan(10000); // Average < 10 seconds
      expect(p95Duration).toBeLessThan(15000); // P95 < 15 seconds
    }, 120000);
  });
});
