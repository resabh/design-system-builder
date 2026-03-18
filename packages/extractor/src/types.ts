/**
 * Type definitions for design system extraction
 */

import type { Page } from 'playwright';

// ============================================================================
// Extractor Options
// ============================================================================

export interface ExtractorOptions {
  /** Browser viewport size */
  viewport?: { width: number; height: number };
  /** Capture component state variations (hover, focus, etc.) */
  captureStates?: boolean;
  /** Maximum number of components to capture */
  maxComponents?: number;
  /** Output format for design system */
  outputFormat?: 'w3c-dtcg' | 'figma-tokens' | 'css-vars';
  /** Timeout for page load (ms) */
  timeout?: number;
}

// ============================================================================
// Screenshot Types
// ============================================================================

export interface Screenshot {
  /** Type of screenshot */
  type: 'full-page' | 'component' | 'state';
  /** Image buffer */
  buffer: Buffer;
  /** Viewport size when captured */
  viewport?: { width: number; height: number };
  /** Component selector (for component screenshots) */
  component?: string;
  /** Component state (for state screenshots) */
  state?: 'default' | 'hover' | 'focus' | 'active' | 'disabled';
  /** Element bounding box */
  bounds?: { x: number; y: number; width: number; height: number };
}

// ============================================================================
// Vision Analysis Types
// ============================================================================

export interface VisionAnalysis {
  /** Extracted design tokens */
  tokens: {
    colors: ColorToken[];
    typography: TypographyToken[];
    spacing: SpacingToken[];
    shadows: ShadowToken[];
    borderRadius: BorderRadiusToken[];
  };
  /** Analyzed components */
  components: ComponentAnalysis[];
  /** Identified patterns */
  patterns: PatternAnalysis[];
}

export interface ColorToken {
  /** Token name (e.g., 'primary', 'secondary') */
  name: string;
  /** Hex color value */
  value: string;
  /** Usage context */
  usage?: string;
  /** Shade/variant (e.g., '500', 'light', 'dark') */
  variant?: string;
}

export interface TypographyToken {
  /** Token name (e.g., 'heading-1', 'body') */
  name: string;
  /** Font family */
  fontFamily: string;
  /** Font size (with unit) */
  fontSize: string;
  /** Font weight */
  fontWeight: string | number;
  /** Line height */
  lineHeight?: string;
  /** Letter spacing */
  letterSpacing?: string;
}

export interface SpacingToken {
  /** Token name (e.g., 'spacing-1', 'gap-md') */
  name: string;
  /** Spacing value (with unit) */
  value: string;
  /** Usage context */
  usage?: string;
}

export interface ShadowToken {
  /** Token name (e.g., 'shadow-sm', 'elevation-2') */
  name: string;
  /** CSS box-shadow value */
  value: string;
  /** Usage context */
  usage?: string;
}

export interface BorderRadiusToken {
  /** Token name (e.g., 'radius-sm', 'rounded-lg') */
  name: string;
  /** Border radius value (with unit) */
  value: string;
  /** Usage context */
  usage?: string;
}

export interface ComponentAnalysis {
  /** Component type (e.g., 'button', 'input', 'card') */
  type: string;
  /** Component name/variant */
  name: string;
  /** Visual description */
  description: string;
  /** Identified variants */
  variants?: string[];
  /** Extracted styles */
  styles?: Record<string, string>;
}

export interface PatternAnalysis {
  /** Pattern type (e.g., 'layout', 'spacing', 'color-usage') */
  type: string;
  /** Pattern description */
  description: string;
  /** Pattern examples */
  examples?: string[];
}

// ============================================================================
// Code Inspection Types
// ============================================================================

export interface HTMLStructure {
  /** Identified components with selectors */
  components: ComponentElement[];
  /** DOM hierarchy information */
  hierarchy: HierarchyNode;
}

export interface ComponentElement {
  /** CSS selector */
  selector: string;
  /** Component type (inferred) */
  type: string;
  /** HTML tag name */
  tagName: string;
  /** Class names */
  classNames: string[];
  /** Role attribute */
  role?: string;
}

export interface HierarchyNode {
  /** Tag name */
  tag: string;
  /** Classes */
  classes: string[];
  /** Children nodes */
  children: HierarchyNode[];
}

export interface StylesAnalysis {
  /** Computed styles for elements */
  elements: ElementStyles[];
}

export interface ElementStyles {
  /** CSS selector */
  selector: string;
  /** Computed CSS properties */
  styles: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontFamily?: string;
    fontWeight?: string;
    lineHeight?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    boxShadow?: string;
    border?: string;
    display?: string;
    gap?: string;
  };
}

// ============================================================================
// Network Analysis Types
// ============================================================================

export interface NetworkResources {
  /** Captured CSS files */
  css: CSSResource[];
  /** Captured font files */
  fonts: FontResource[];
  /** Design token files (if found) */
  designTokens: DesignTokenResource[];
}

export interface CSSResource {
  /** Resource URL */
  url: string;
  /** CSS content */
  content: string;
}

export interface FontResource {
  /** Font URL */
  url: string;
  /** Font family name (if parseable) */
  family?: string;
}

export interface DesignTokenResource {
  /** Resource URL */
  url: string;
  /** Parsed JSON content */
  content: any;
}

// ============================================================================
// Design System Output Types
// ============================================================================

export interface DesignSystem {
  /** Design tokens */
  tokens: DesignTokens;
  /** Component definitions */
  components: Component[];
  /** Design patterns */
  patterns: Pattern[];
  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

export interface DesignTokens {
  /** Color tokens */
  color: Record<string, string>;
  /** Typography tokens */
  typography: Record<string, TypographyValue>;
  /** Spacing tokens */
  spacing: Record<string, string>;
  /** Shadow tokens */
  shadow: Record<string, string>;
  /** Border radius tokens */
  borderRadius: Record<string, string>;
}

export interface TypographyValue {
  fontFamily: string;
  fontSize: string;
  fontWeight: string | number;
  lineHeight?: string;
  letterSpacing?: string;
}

export interface Component {
  /** Component name */
  name: string;
  /** Component type (e.g., 'button', 'input') */
  type: string;
  /** Component description */
  description: string;
  /** Component variants */
  variants: ComponentVariant[];
  /** Default styles */
  styles: Record<string, string>;
}

export interface ComponentVariant {
  /** Variant name (e.g., 'primary', 'secondary', 'large') */
  name: string;
  /** Variant styles (overrides) */
  styles: Record<string, string>;
}

export interface Pattern {
  /** Pattern name */
  name: string;
  /** Pattern type */
  type: string;
  /** Pattern description */
  description: string;
  /** Example usage */
  examples: string[];
}

export interface ExtractionMetadata {
  /** Source URL */
  sourceUrl: string;
  /** Extraction timestamp */
  extractedAt: string;
  /** AI provider used */
  provider: string;
  /** Extraction cost (USD) */
  cost: number;
  /** Token usage */
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// Internal Data Aggregation Types
// ============================================================================

export interface AllSources {
  /** Vision analysis from screenshots */
  visionAnalysis: VisionAnalysis;
  /** HTML structure analysis */
  htmlStructure: HTMLStructure;
  /** Computed styles analysis */
  styles: StylesAnalysis;
  /** Network resources */
  networkResources: NetworkResources;
}
