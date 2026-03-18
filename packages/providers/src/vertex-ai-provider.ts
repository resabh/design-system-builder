/**
 * Google Cloud Vertex AI Provider
 *
 * Uses Claude through Google Cloud Vertex AI
 * Supports Service Account and Application Default Credentials
 */

import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import type {
  LLMProvider,
  ProviderConfig,
  VisionRequest,
  VisionResponse,
  PricingInfo,
  TokenUsage
} from './types';

export interface VertexAIConfig extends ProviderConfig {
  /** GCP Project ID */
  projectId: string;
  /** GCP Region (e.g., 'us-central1') */
  location: string;
  /** Authentication type */
  authType?: 'service-account' | 'adc';
  /** Path to service account JSON (if using service account) */
  serviceAccountPath?: string;
  /** Service account credentials object (alternative to path) */
  credentials?: any;
  /** Model to use */
  model?: string;
}

export class VertexAIProvider implements LLMProvider {
  readonly name = 'vertex-ai';

  private vertex!: VertexAI;
  private config!: VertexAIConfig;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config as VertexAIConfig;

    if (!this.config.projectId) {
      throw new Error('GCP project ID is required');
    }

    if (!this.config.location) {
      throw new Error('GCP location/region is required');
    }

    // Initialize Vertex AI client
    const vertexConfig: any = {
      project: this.config.projectId,
      location: this.config.location
    };

    // Add auth if provided
    if (this.config.serviceAccountPath) {
      vertexConfig.googleAuthOptions = {
        keyFilename: this.config.serviceAccountPath
      };
    } else if (this.config.credentials) {
      vertexConfig.googleAuthOptions = {
        credentials: this.config.credentials
      };
    }

    this.vertex = new VertexAI(vertexConfig);
  }

  async validate(): Promise<boolean> {
    try {
      const auth = new GoogleAuth({
        projectId: this.config.projectId,
        ...(this.config.serviceAccountPath && {
          keyFilename: this.config.serviceAccountPath
        }),
        ...(this.config.credentials && {
          credentials: this.config.credentials
        }),
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });

      const client = await auth.getClient();
      const projectId = await auth.getProjectId();

      console.log('✅ GCP authentication successful');
      console.log(`   Project: ${projectId}`);
      console.log(`   Region: ${this.config.location}`);

      return true;
    } catch (error: any) {
      console.error('❌ GCP authentication failed:', error.message);
      console.error('   Make sure:');
      console.error('   1. Vertex AI API is enabled in your GCP project');
      console.error('   2. Service account has Vertex AI User role');
      console.error('   3. Credentials are valid');
      return false;
    }
  }

  async analyzeImage(request: VisionRequest): Promise<VisionResponse> {
    const model = this.config.model || 'claude-3-opus@20240229';

    const generativeModel = this.vertex.preview.getGenerativeModel({
      model
    });

    // Convert images to Vertex format
    const imageParts = request.images.map(img => ({
      inlineData: {
        mimeType: 'image/png',
        data: img.toString('base64')
      }
    }));

    const result = await generativeModel.generateContent({
      contents: [{
        role: 'user',
        parts: [
          ...imageParts,
          { text: request.prompt }
        ]
      }],
      generationConfig: {
        maxOutputTokens: request.maxTokens || 8192,
        temperature: request.temperature !== undefined ? request.temperature : 1.0
      }
    });

    const response = result.response;

    // Extract text content
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract usage metadata
    const usage = response.usageMetadata || {
      promptTokenCount: 0,
      candidatesTokenCount: 0
    };

    return {
      content: text,
      usage: {
        inputTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0
      },
      model,
      raw: response
    };
  }

  getPricing(): PricingInfo {
    // Vertex AI pricing for Claude (similar to direct Anthropic)
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
