/**
 * Common types for AI provider abstraction
 */

export interface VisionRequest {
  /** Base64 encoded images or image buffers */
  images: Buffer[];
  /** Prompt for analysis */
  prompt: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for generation (0-1) */
  temperature?: number;
}

export interface VisionResponse {
  /** Generated text content */
  content: string;
  /** Token usage information */
  usage: TokenUsage;
  /** Model identifier used */
  model: string;
  /** Raw response for debugging */
  raw?: any;
}

export interface TokenUsage {
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
}

export interface PricingInfo {
  /** USD per 1M input tokens */
  inputPer1M: number;
  /** USD per 1M output tokens */
  outputPer1M: number;
  /** Currency code */
  currency: string;
}

export interface ProviderConfig {
  /** Provider-specific configuration */
  [key: string]: any;
}

export interface LLMProvider {
  /** Provider name (e.g., 'anthropic', 'vertex-ai') */
  readonly name: string;

  /**
   * Initialize the provider with configuration
   * @param config Provider-specific configuration
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Validate credentials/configuration
   * @returns true if valid, false otherwise
   */
  validate(): Promise<boolean>;

  /**
   * Analyze images with vision API
   * @param request Vision analysis request
   * @returns Analysis response
   */
  analyzeImage(request: VisionRequest): Promise<VisionResponse>;

  /**
   * Get pricing information for this provider
   * @returns Pricing details
   */
  getPricing(): PricingInfo;

  /**
   * Calculate cost for given token usage
   * @param usage Token usage information
   * @returns Cost in USD
   */
  calculateCost(usage: TokenUsage): number;
}
