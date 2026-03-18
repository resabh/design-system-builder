/**
 * Custom error types for design system extraction
 */

/**
 * Base error class for all extraction errors
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ExtractionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Invalid URL or URL validation failure
 */
export class InvalidURLError extends ExtractionError {
  constructor(message: string, url?: string) {
    super(message, 'INVALID_URL', { url });
    this.name = 'InvalidURLError';
  }
}

/**
 * Page size exceeds limits
 */
export class PageSizeLimitError extends ExtractionError {
  constructor(size: number, limit: number, url: string) {
    super(
      `Page size ${size} bytes exceeds limit of ${limit} bytes`,
      'PAGE_SIZE_LIMIT',
      { size, limit, url }
    );
    this.name = 'PageSizeLimitError';
  }
}

/**
 * Browser operation timeout
 */
export class BrowserTimeoutError extends ExtractionError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Browser operation '${operation}' timed out after ${timeoutMs}ms`,
      'BROWSER_TIMEOUT',
      { operation, timeoutMs }
    );
    this.name = 'BrowserTimeoutError';
  }
}

/**
 * Screenshot capture failure
 */
export class ScreenshotError extends ExtractionError {
  constructor(message: string, component?: string, cause?: Error) {
    super(message, 'SCREENSHOT_ERROR', { component, cause: cause?.message });
    this.name = 'ScreenshotError';
  }
}

/**
 * Vision API analysis failure
 */
export class VisionAnalysisError extends ExtractionError {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly rawResponse?: string
  ) {
    super(message, 'VISION_ANALYSIS_ERROR', {
      cause: cause?.message,
      responseLength: rawResponse?.length
    });
    this.name = 'VisionAnalysisError';
  }
}

/**
 * JSON parsing failure from AI response
 */
export class JSONParseError extends ExtractionError {
  constructor(content: string, public readonly cause: Error, public readonly rawResponse: string = content) {
    super('Failed to parse AI response as JSON', 'JSON_PARSE_ERROR', {
      cause: cause.message,
      responseLength: content.length
    });
    this.name = 'JSONParseError';
  }
}

/**
 * Invalid response structure from AI
 */
export class InvalidResponseError extends ExtractionError {
  constructor(message: string, public readonly response: any, public readonly rawResponse: string = JSON.stringify(response)) {
    super(message, 'INVALID_RESPONSE', {
      responseLength: rawResponse.length
    });
    this.name = 'InvalidResponseError';
  }
}

/**
 * Cost limit exceeded
 */
export class CostLimitError extends ExtractionError {
  constructor(estimatedCost: number, limit: number) {
    super(
      `Estimated cost $${estimatedCost.toFixed(4)} exceeds limit of $${limit.toFixed(4)}`,
      'COST_LIMIT_EXCEEDED',
      { estimatedCost, limit }
    );
    this.name = 'CostLimitError';
  }
}

/**
 * Network request failure
 */
export class NetworkError extends ExtractionError {
  constructor(message: string, url: string, cause?: Error) {
    super(message, 'NETWORK_ERROR', { url, cause: cause?.message });
    this.name = 'NetworkError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends ExtractionError {
  constructor(message: string, field: string, value: any) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

/**
 * Resource limit exceeded
 */
export class ResourceLimitError extends ExtractionError {
  constructor(resource: string, current: number, limit: number) {
    super(
      `${resource} limit exceeded: ${current} > ${limit}`,
      'RESOURCE_LIMIT_EXCEEDED',
      { resource, current, limit }
    );
    this.name = 'ResourceLimitError';
  }
}
