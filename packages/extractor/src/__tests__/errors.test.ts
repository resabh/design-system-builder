/**
 * Tests for custom error types
 */

import {
  ExtractionError,
  InvalidURLError,
  PageSizeLimitError,
  BrowserTimeoutError,
  VisionAnalysisError,
  JSONParseError,
  CostLimitError
} from '../errors';

describe('ExtractionError', () => {
  it('should create error with message and code', () => {
    const error = new ExtractionError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('ExtractionError');
  });

  it('should include context', () => {
    const context = { url: 'https://example.com', attempt: 1 };
    const error = new ExtractionError('Test error', 'TEST_CODE', context);
    expect(error.context).toEqual(context);
  });

  it('should have stack trace', () => {
    const error = new ExtractionError('Test error', 'TEST_CODE');
    expect(error.stack).toBeDefined();
  });
});

describe('InvalidURLError', () => {
  it('should create error with URL', () => {
    const error = new InvalidURLError('Invalid URL', 'bad-url');
    expect(error.message).toBe('Invalid URL');
    expect(error.code).toBe('INVALID_URL');
    expect(error.context?.url).toBe('bad-url');
  });
});

describe('PageSizeLimitError', () => {
  it('should create error with size details', () => {
    const error = new PageSizeLimitError(20000000, 10000000, 'https://example.com');
    expect(error.message).toContain('20000000');
    expect(error.message).toContain('10000000');
    expect(error.code).toBe('PAGE_SIZE_LIMIT');
    expect(error.context?.size).toBe(20000000);
    expect(error.context?.limit).toBe(10000000);
  });
});

describe('BrowserTimeoutError', () => {
  it('should create error with operation details', () => {
    const error = new BrowserTimeoutError('navigation', 30000);
    expect(error.message).toContain('navigation');
    expect(error.message).toContain('30000');
    expect(error.code).toBe('BROWSER_TIMEOUT');
  });
});

describe('VisionAnalysisError', () => {
  it('should create error with cause', () => {
    const cause = new Error('Original error');
    const error = new VisionAnalysisError('Analysis failed', cause);
    expect(error.message).toBe('Analysis failed');
    expect(error.cause).toBe(cause);
  });

  it('should include raw response', () => {
    const rawResponse = '{"invalid": json}';
    const error = new VisionAnalysisError('Parse failed', undefined, rawResponse);
    expect(error.rawResponse).toBe(rawResponse);
  });
});

describe('JSONParseError', () => {
  it('should extend ExtractionError', () => {
    const cause = new SyntaxError('Unexpected token');
    const error = new JSONParseError('bad json', cause);
    expect(error).toBeInstanceOf(ExtractionError);
    expect(error.code).toBe('JSON_PARSE_ERROR');
    expect(error.message).toContain('JSON');
  });
});

describe('CostLimitError', () => {
  it('should create error with cost details', () => {
    const error = new CostLimitError(1.5, 1.0);
    expect(error.message).toContain('1.5');
    expect(error.message).toContain('1.0');
    expect(error.code).toBe('COST_LIMIT_EXCEEDED');
    expect(error.context?.estimatedCost).toBe(1.5);
    expect(error.context?.limit).toBe(1.0);
  });
});
