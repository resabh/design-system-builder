/**
 * Anthropic Direct API Provider
 *
 * Uses Anthropic's API directly with user's API key
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ProviderConfig,
  VisionRequest,
  VisionResponse,
  PricingInfo,
  TokenUsage
} from './types';

export interface AnthropicConfig extends ProviderConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use (default: claude-opus-4) */
  model?: string;
  /** API base URL (optional, for testing) */
  baseUrl?: string;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';

  private client!: Anthropic;
  private config!: AnthropicConfig;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config as AnthropicConfig;

    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      ...(this.config.baseUrl && { baseURL: this.config.baseUrl })
    });
  }

  async validate(): Promise<boolean> {
    try {
      // Test with minimal request
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'Hi'
        }]
      });

      return response.content.length > 0;
    } catch (error: any) {
      console.error('❌ Anthropic API key validation failed:', error.message);
      return false;
    }
  }

  async analyzeImage(request: VisionRequest): Promise<VisionResponse> {
    const model = this.config.model || 'claude-opus-4';

    // Build content array with images + prompt
    const content: any[] = [
      ...request.images.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: img.toString('base64')
        }
      })),
      {
        type: 'text',
        text: request.prompt
      }
    ];

    const response = await this.client.messages.create({
      model,
      max_tokens: request.maxTokens || 8192,
      temperature: request.temperature,
      messages: [{
        role: 'user',
        content
      }]
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text : '';

    return {
      content: text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      },
      model: response.model,
      raw: response
    };
  }

  getPricing(): PricingInfo {
    // Claude Opus pricing as of 2026
    return {
      inputPer1M: 15,
      outputPer1M: 75,
      currency: 'USD'
    };
  }

  calculateCost(usage: TokenUsage): number {
    const pricing = this.getPricing();
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPer1M;
    return inputCost + outputCost;
  }
}
