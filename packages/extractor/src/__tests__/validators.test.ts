/**
 * Tests for validation utilities
 */

import {
  validateURLFormat,
  validateExtractorOptions,
  estimateCost,
  DEFAULT_LIMITS
} from '../validators';

describe('validateURLFormat', () => {
  it('should accept valid HTTP URLs', () => {
    const result = validateURLFormat('http://example.com');
    expect(result.valid).toBe(true);
  });

  it('should accept valid HTTPS URLs', () => {
    const result = validateURLFormat('https://example.com');
    expect(result.valid).toBe(true);
  });

  it('should reject invalid URL format', () => {
    const result = validateURLFormat('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid URL format');
  });

  it('should reject file:// URLs', () => {
    const result = validateURLFormat('file:///etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('should reject data: URLs', () => {
    const result = validateURLFormat('data:text/html,<h1>Test</h1>');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('should reject ftp:// URLs', () => {
    const result = validateURLFormat('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('should handle URLs with paths and query params', () => {
    const result = validateURLFormat('https://example.com/path?query=value');
    expect(result.valid).toBe(true);
  });

  it('should handle URLs with ports', () => {
    const result = validateURLFormat('https://example.com:8080');
    expect(result.valid).toBe(true);
  });
});

describe('validateExtractorOptions', () => {
  it('should accept valid options', () => {
    const result = validateExtractorOptions({
      viewport: { width: 1920, height: 1080 },
      maxComponents: 20,
      timeout: 30000
    });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid viewport width', () => {
    const result = validateExtractorOptions({
      viewport: { width: -100, height: 1080 }
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('viewport.width');
  });

  it('should reject invalid viewport height', () => {
    const result = validateExtractorOptions({
      viewport: { width: 1920, height: 0 }
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('viewport.height');
  });

  it('should reject negative maxComponents', () => {
    const result = validateExtractorOptions({
      maxComponents: -5
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('maxComponents');
  });

  it('should reject invalid timeout', () => {
    const result = validateExtractorOptions({
      timeout: 0
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('should accept zero maxComponents', () => {
    const result = validateExtractorOptions({
      maxComponents: 0
    });
    expect(result.valid).toBe(true);
  });
});

describe('estimateCost', () => {
  it('should estimate base cost correctly', () => {
    const cost = estimateCost({});
    expect(cost).toBeGreaterThan(0);
    // Default has 20 components, so cost is baseCost + (20 * 0.002) = 0.02 + 0.04 = 0.06
    expect(cost).toBeLessThan(0.10);
  });

  it('should add cost for components', () => {
    const baseCost = estimateCost({ maxComponents: 0 });
    const withComponents = estimateCost({ maxComponents: 10 });
    // Should add cost for components
    expect(withComponents).toBeGreaterThan(baseCost);
    // Verify it's approximately baseCost + (10 * 0.002)
    expect(withComponents).toBeCloseTo(baseCost + 0.02, 2);
  });

  it('should add cost for state capture', () => {
    const without = estimateCost({ captureStates: false, maxComponents: 10 });
    const with_ = estimateCost({ captureStates: true, maxComponents: 10 });
    expect(with_).toBeGreaterThan(without);
  });

  it('should cap component count at 20', () => {
    const with20 = estimateCost({ maxComponents: 20 });
    const with100 = estimateCost({ maxComponents: 100 });
    expect(with20).toBe(with100);
  });

  it('should return reasonable estimate', () => {
    const cost = estimateCost({ maxComponents: 20, captureStates: true });
    expect(cost).toBeLessThan(1.0); // Should be less than $1
    expect(cost).toBeGreaterThan(0.01); // Should be more than 1 cent
  });
});

describe('DEFAULT_LIMITS', () => {
  it('should have reasonable maxPageSize', () => {
    expect(DEFAULT_LIMITS.maxPageSize).toBe(10 * 1024 * 1024); // 10MB
  });

  it('should have reasonable maxTimeout', () => {
    expect(DEFAULT_LIMITS.maxTimeout).toBe(30000); // 30s
  });

  it('should have reasonable maxScreenshots', () => {
    expect(DEFAULT_LIMITS.maxScreenshots).toBeGreaterThan(0);
  });

  it('should have reasonable maxCost', () => {
    expect(DEFAULT_LIMITS.maxCost).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxCost).toBeLessThan(10);
  });
});
