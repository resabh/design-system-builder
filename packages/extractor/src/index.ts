/**
 * Extractor package exports
 */

export { DesignSystemExtractor } from './extractor';
export { ScreenshotCapture } from './screenshot-capture';
export { VisionAnalyzer } from './vision-analyzer';
export { CodeInspector } from './code-inspector';
export { NetworkAnalyzer } from './network-analyzer';
export { DesignSystemBuilder } from './design-system-builder';

// Error classes
export {
  ExtractionError,
  InvalidURLError,
  PageSizeLimitError,
  BrowserTimeoutError,
  ScreenshotError,
  VisionAnalysisError,
  JSONParseError,
  InvalidResponseError,
  CostLimitError,
  NetworkError,
  ValidationError,
  ResourceLimitError
} from './errors';

// Validators
export {
  validateURL,
  validateURLFormat,
  validateURLAccessibility,
  validateExtractorOptions,
  estimateCost,
  DEFAULT_LIMITS
} from './validators';

// Logger
export { Logger, createLogger, logger } from './logger';

// Retry utilities
export { withRetry, BROWSER_RETRY_OPTIONS, API_RETRY_OPTIONS } from './retry';

// Types
export type {
  ExtractorOptions,
  Screenshot,
  VisionAnalysis,
  ColorToken,
  TypographyToken,
  SpacingToken,
  ShadowToken,
  BorderRadiusToken,
  ComponentAnalysis,
  PatternAnalysis,
  HTMLStructure,
  StylesAnalysis,
  NetworkResources,
  DesignSystem,
  DesignTokens,
  Component,
  ComponentVariant,
  Pattern,
  ExtractionMetadata
} from './types';

export type { ValidationResult, ExtractionLimits } from './validators';
export type { RetryOptions } from './retry';
