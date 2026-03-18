/**
 * Provider Factory
 *
 * Creates and initializes AI providers based on configuration
 */

import type { LLMProvider, ProviderConfig } from './types';
import { AnthropicProvider } from './anthropic-provider';
import { VertexAIProvider } from './vertex-ai-provider';

export type ProviderType = 'anthropic' | 'vertex-ai';

export class ProviderFactory {
  /**
   * Create a provider instance (not initialized)
   * @param providerType Type of provider to create
   * @returns Uninitialized provider instance
   */
  static create(providerType: ProviderType): LLMProvider {
    switch (providerType) {
      case 'anthropic':
        return new AnthropicProvider();

      case 'vertex-ai':
        return new VertexAIProvider();

      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }

  /**
   * Create and initialize a provider
   * @param providerType Type of provider
   * @param config Provider configuration
   * @returns Initialized and validated provider
   */
  static async initialize(
    providerType: ProviderType,
    config: ProviderConfig
  ): Promise<LLMProvider> {
    const provider = this.create(providerType);

    try {
      await provider.initialize(config);

      const isValid = await provider.validate();
      if (!isValid) {
        throw new Error(`Provider ${providerType} validation failed`);
      }

      return provider;
    } catch (error: any) {
      throw new Error(
        `Failed to initialize ${providerType} provider: ${error.message}`
      );
    }
  }

  /**
   * Get list of supported providers
   * @returns Array of supported provider types
   */
  static getSupportedProviders(): ProviderType[] {
    return ['anthropic', 'vertex-ai'];
  }

  /**
   * Check if a provider type is supported
   * @param providerType Provider type to check
   * @returns true if supported
   */
  static isSupported(providerType: string): providerType is ProviderType {
    return this.getSupportedProviders().includes(providerType as ProviderType);
  }
}
