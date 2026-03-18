/**
 * Extractor package exports
 */

export { DesignSystemExtractor } from './extractor';
export { ScreenshotCapture } from './screenshot-capture';
export { VisionAnalyzer } from './vision-analyzer';
export { CodeInspector } from './code-inspector';
export { NetworkAnalyzer } from './network-analyzer';
export { DesignSystemBuilder } from './design-system-builder';

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
