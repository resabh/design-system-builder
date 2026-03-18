#!/bin/bash

# Design System Builder - File Setup Script
# This script creates all remaining TypeScript source files

set -e

echo "🎨 Design System Builder - File Setup"
echo "======================================"
echo ""

BASE_DIR="/Users/rishabhpatel/design-system-builder"
cd "$BASE_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create Vertex AI Provider
echo -e "${BLUE}Creating packages/providers/src/vertex-ai-provider.ts${NC}"
cat > packages/providers/src/vertex-ai-provider.ts << 'EOF'
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
EOF

# Create Provider Factory
echo -e "${BLUE}Creating packages/providers/src/provider-factory.ts${NC}"
cat > packages/providers/src/provider-factory.ts << 'EOF'
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
EOF

# Create Providers Index
echo -e "${BLUE}Creating packages/providers/src/index.ts${NC}"
cat > packages/providers/src/index.ts << 'EOF'
/**
 * Provider package exports
 */

export { ProviderFactory } from './provider-factory';
export type { ProviderType } from './provider-factory';

export { AnthropicProvider } from './anthropic-provider';
export type { AnthropicConfig } from './anthropic-provider';

export { VertexAIProvider } from './vertex-ai-provider';
export type { VertexAIConfig } from './vertex-ai-provider';

export type {
  LLMProvider,
  ProviderConfig,
  VisionRequest,
  VisionResponse,
  PricingInfo,
  TokenUsage
} from './types';
EOF

echo -e "${GREEN}✓ Providers package complete${NC}"
echo ""

# Create Core package files
echo -e "${BLUE}Creating packages/core/package.json${NC}"
cat > packages/core/package.json << 'EOF'
{
  "name": "@dsb/core",
  "version": "0.1.0",
  "description": "Core functionality for Design System Builder",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "watch": "tsc --watch"
  },
  "dependencies": {
    "@dsb/providers": "^0.1.0",
    "node-forge": "^1.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/node-forge": "^1.3.0",
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
EOF

echo -e "${BLUE}Creating packages/core/tsconfig.json${NC}"
cat > packages/core/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF

# Create Config Manager (this is a long file, split into parts)
echo -e "${BLUE}Creating packages/core/src/config-manager.ts${NC}"
cat > packages/core/src/config-manager.ts << 'EOF'
/**
 * Configuration Manager
 *
 * Handles reading, writing, and encrypting user configuration
 * Stores API keys securely with encryption
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import type { ProviderConfig } from '@dsb/providers';

export interface DSBConfig {
  /** Default provider to use */
  defaultProvider: 'anthropic' | 'vertex-ai';
  /** Provider configurations (encrypted) */
  providers: {
    anthropic?: EncryptedProviderConfig;
    'vertex-ai'?: EncryptedProviderConfig;
  };
  /** User preferences */
  preferences: {
    /** Show cost estimates before operations */
    showCostEstimates: boolean;
    /** Output directory for extracted design systems */
    outputDir: string;
    /** Enable usage analytics (opt-in) */
    analytics: boolean;
  };
  /** Config version for migrations */
  version: string;
}

export interface EncryptedProviderConfig {
  /** Encrypted configuration data */
  encrypted: string;
  /** Initialization vector for decryption */
  iv: string;
  /** Salt for key derivation */
  salt: string;
}

export class ConfigManager {
  private static readonly CONFIG_DIR = path.join(os.homedir(), '.dsb');
  private static readonly CONFIG_FILE = path.join(ConfigManager.CONFIG_DIR, 'config.json');
  private static readonly VERSION = '1.0.0';

  /**
   * Get machine-specific encryption key
   * Uses machine ID + username to ensure configs aren't portable
   */
  private static getEncryptionKey(): string {
    // Use machine-specific identifiers
    const machineId = this.getMachineId();
    const username = os.userInfo().username;

    // Derive key from machine ID + username
    const key = crypto.createHash('sha256')
      .update(`${machineId}:${username}`)
      .digest('hex');

    return key;
  }

  /**
   * Get machine ID for encryption key derivation
   */
  private static getMachineId(): string {
    // Try to get a stable machine identifier
    try {
      const networkInterfaces = os.networkInterfaces();
      const macAddresses = Object.values(networkInterfaces)
        .flat()
        .filter(iface => iface && !iface.internal && iface.mac !== '00:00:00:00:00:00')
        .map(iface => iface!.mac)
        .sort();

      if (macAddresses.length > 0) {
        return macAddresses[0];
      }
    } catch (error) {
      // Fallback to hostname
    }

    return os.hostname();
  }

  /**
   * Encrypt provider configuration
   */
  private static encryptConfig(config: ProviderConfig): EncryptedProviderConfig {
    const key = this.getEncryptionKey();

    // Generate random salt and IV
    const salt = crypto.randomBytes(16).toString('hex');
    const iv = crypto.randomBytes(16);

    // Derive encryption key from master key + salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');

    // Encrypt config
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(config), 'utf8'),
      cipher.final()
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
      iv: iv.toString('hex'),
      salt
    };
  }

  /**
   * Decrypt provider configuration
   */
  private static decryptConfig(encrypted: EncryptedProviderConfig): ProviderConfig {
    const key = this.getEncryptionKey();

    // Derive decryption key
    const derivedKey = crypto.pbkdf2Sync(key, encrypted.salt, 100000, 32, 'sha256');

    // Parse encrypted data
    const encryptedBuffer = Buffer.from(encrypted.encrypted, 'base64');
    const authTag = encryptedBuffer.slice(-16);
    const data = encryptedBuffer.slice(0, -16);

    // Decrypt
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      derivedKey,
      Buffer.from(encrypted.iv, 'hex')
    );
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final()
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Ensure config directory exists
   */
  private static ensureConfigDir(): void {
    if (!fs.existsSync(this.CONFIG_DIR)) {
      fs.mkdirSync(this.CONFIG_DIR, { mode: 0o700, recursive: true });
    }
  }

  /**
   * Load configuration from disk
   */
  static load(): DSBConfig | null {
    try {
      if (!fs.existsSync(this.CONFIG_FILE)) {
        return null;
      }

      const data = fs.readFileSync(this.CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error: any) {
      console.error('Failed to load config:', error.message);
      return null;
    }
  }

  /**
   * Save configuration to disk
   */
  static save(config: DSBConfig): void {
    try {
      this.ensureConfigDir();

      fs.writeFileSync(
        this.CONFIG_FILE,
        JSON.stringify(config, null, 2),
        { mode: 0o600 }
      );
    } catch (error: any) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Get default configuration
   */
  static getDefault(): DSBConfig {
    return {
      defaultProvider: 'anthropic',
      providers: {},
      preferences: {
        showCostEstimates: true,
        outputDir: path.join(os.homedir(), 'design-systems'),
        analytics: false
      },
      version: this.VERSION
    };
  }

  /**
   * Set provider configuration
   */
  static setProvider(
    provider: 'anthropic' | 'vertex-ai',
    config: ProviderConfig
  ): void {
    const dsbConfig = this.load() || this.getDefault();

    // Encrypt and store
    dsbConfig.providers[provider] = this.encryptConfig(config);

    // Set as default if first provider
    if (Object.keys(dsbConfig.providers).length === 1) {
      dsbConfig.defaultProvider = provider;
    }

    this.save(dsbConfig);
  }

  /**
   * Get provider configuration (decrypted)
   */
  static getProvider(provider: 'anthropic' | 'vertex-ai'): ProviderConfig | null {
    const config = this.load();
    if (!config) return null;

    const providerConfig = config.providers[provider];
    if (!providerConfig) return null;

    try {
      return this.decryptConfig(providerConfig);
    } catch (error: any) {
      console.error(`Failed to decrypt ${provider} config:`, error.message);
      return null;
    }
  }

  /**
   * Get default provider configuration
   */
  static getDefaultProvider(): { provider: string; config: ProviderConfig } | null {
    const config = this.load();
    if (!config) return null;

    const providerName = config.defaultProvider;
    const providerConfig = this.getProvider(providerName);

    if (!providerConfig) return null;

    return {
      provider: providerName,
      config: providerConfig
    };
  }

  /**
   * Set default provider
   */
  static setDefaultProvider(provider: 'anthropic' | 'vertex-ai'): void {
    const config = this.load() || this.getDefault();

    if (!config.providers[provider]) {
      throw new Error(`Provider ${provider} not configured. Run 'dsb config' first.`);
    }

    config.defaultProvider = provider;
    this.save(config);
  }

  /**
   * Remove provider configuration
   */
  static removeProvider(provider: 'anthropic' | 'vertex-ai'): void {
    const config = this.load();
    if (!config) return;

    delete config.providers[provider];

    // Switch default if needed
    if (config.defaultProvider === provider) {
      const remaining = Object.keys(config.providers) as ('anthropic' | 'vertex-ai')[];
      config.defaultProvider = remaining[0] || 'anthropic';
    }

    this.save(config);
  }

  /**
   * Update preferences
   */
  static updatePreferences(preferences: Partial<DSBConfig['preferences']>): void {
    const config = this.load() || this.getDefault();
    config.preferences = { ...config.preferences, ...preferences };
    this.save(config);
  }

  /**
   * Check if any provider is configured
   */
  static hasProvider(): boolean {
    const config = this.load();
    if (!config) return false;

    return Object.keys(config.providers).length > 0;
  }

  /**
   * Get config file path (for debugging)
   */
  static getConfigPath(): string {
    return this.CONFIG_FILE;
  }

  /**
   * Reset configuration (delete config file)
   */
  static reset(): void {
    try {
      if (fs.existsSync(this.CONFIG_FILE)) {
        fs.unlinkSync(this.CONFIG_FILE);
      }
    } catch (error: any) {
      throw new Error(`Failed to reset config: ${error.message}`);
    }
  }
}
EOF

# Create Core Index
echo -e "${BLUE}Creating packages/core/src/index.ts${NC}"
cat > packages/core/src/index.ts << 'EOF'
/**
 * Core package exports
 */

export { ConfigManager } from './config-manager';
export type { DSBConfig, EncryptedProviderConfig } from './config-manager';
EOF

echo -e "${GREEN}✓ Core package complete${NC}"
echo ""

# Create CLI package files
echo -e "${BLUE}Creating packages/cli/package.json${NC}"
cat > packages/cli/package.json << 'EOF'
{
  "name": "@dsb/cli",
  "version": "0.1.0",
  "description": "Command-line interface for Design System Builder",
  "bin": {
    "dsb": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "watch": "tsc --watch"
  },
  "dependencies": {
    "@dsb/core": "^0.1.0",
    "@dsb/providers": "^0.1.0",
    "commander": "^11.0.0",
    "inquirer": "^9.2.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/inquirer": "^9.0.0",
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
EOF

echo -e "${BLUE}Creating packages/cli/tsconfig.json${NC}"
cat > packages/cli/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF

# Create CLI commands directory
mkdir -p packages/cli/src/commands

# Create CLI config command (long file)
echo -e "${BLUE}Creating packages/cli/src/commands/config.ts${NC}"
cat > packages/cli/src/commands/config.ts << 'EOFCLI'
/**
 * Config Command
 *
 * Interactive setup for API credentials and provider configuration
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '@dsb/core';
import { ProviderFactory } from '@dsb/providers';
import type { AnthropicConfig } from '@dsb/providers/src/anthropic-provider';
import type { VertexAIConfig } from '@dsb/providers/src/vertex-ai-provider';
import * as fs from 'fs';
import * as path from 'path';

export async function configCommand(options: { provider?: string; reset?: boolean }) {
  console.log(chalk.bold('\n🎨 Design System Builder - Configuration\n'));

  // Handle reset
  if (options.reset) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'This will delete all saved configuration. Continue?',
        default: false
      }
    ]);

    if (confirm) {
      ConfigManager.reset();
      console.log(chalk.green('✅ Configuration reset successfully'));
    }
    return;
  }

  // Show current config if exists
  const currentConfig = ConfigManager.load();
  if (currentConfig) {
    console.log(chalk.dim('Current configuration:'));
    console.log(chalk.dim(`  Default provider: ${currentConfig.defaultProvider}`));
    console.log(chalk.dim(`  Configured providers: ${Object.keys(currentConfig.providers).join(', ') || 'none'}`));
    console.log();
  }

  // Select provider
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select AI provider:',
      choices: [
        {
          name: 'Anthropic (Direct API) - Use your Anthropic API key',
          value: 'anthropic',
          short: 'Anthropic'
        },
        {
          name: 'Google Cloud Vertex AI - Use Claude through GCP',
          value: 'vertex-ai',
          short: 'Vertex AI'
        }
      ],
      default: options.provider || currentConfig?.defaultProvider || 'anthropic'
    }
  ]);

  // Provider-specific configuration
  let providerConfig: any;

  if (provider === 'anthropic') {
    providerConfig = await configureAnthropic();
  } else if (provider === 'vertex-ai') {
    providerConfig = await configureVertexAI();
  }

  // Validate credentials
  console.log();
  const spinner = ora('Validating credentials...').start();

  try {
    const providerInstance = await ProviderFactory.initialize(provider, providerConfig);

    spinner.succeed(chalk.green('Credentials validated successfully'));

    // Show pricing info
    const pricing = providerInstance.getPricing();
    console.log(chalk.dim('\nPricing:'));
    console.log(chalk.dim(`  Input:  $${pricing.inputPer1M}/1M tokens`));
    console.log(chalk.dim(`  Output: $${pricing.outputPer1M}/1M tokens`));

    // Save configuration
    ConfigManager.setProvider(provider, providerConfig);

    // Ask if this should be the default
    if (currentConfig && Object.keys(currentConfig.providers).length > 0) {
      const { setDefault } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setDefault',
          message: `Set ${provider} as default provider?`,
          default: true
        }
      ]);

      if (setDefault) {
        ConfigManager.setDefaultProvider(provider);
      }
    }

    console.log(chalk.green('\n✅ Configuration saved successfully'));
    console.log(chalk.dim(`   Config file: ${ConfigManager.getConfigPath()}`));

    // Show usage examples
    console.log(chalk.bold('\n📚 Next steps:'));
    console.log(chalk.dim('   Extract a design system:'));
    console.log(chalk.cyan('   $ dsb extract https://example.com'));
    console.log();

  } catch (error: any) {
    spinner.fail(chalk.red('Validation failed'));
    console.error(chalk.red(`\n❌ ${error.message}`));
    console.log(chalk.dim('\nPlease check your credentials and try again.'));
    process.exit(1);
  }
}

/**
 * Configure Anthropic provider
 */
async function configureAnthropic(): Promise<AnthropicConfig> {
  console.log(chalk.bold('\n🔑 Anthropic API Configuration'));
  console.log(chalk.dim('Get your API key from: https://console.anthropic.com/settings/keys\n'));

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Anthropic API key:',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'API key is required';
        }
        if (!input.startsWith('sk-ant-')) {
          return 'Invalid API key format (should start with sk-ant-)';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'model',
      message: 'Select Claude model:',
      choices: [
        {
          name: 'Claude Opus 4 (Recommended) - Most capable',
          value: 'claude-opus-4',
          short: 'Opus 4'
        },
        {
          name: 'Claude Sonnet 3.5 - Fast and capable',
          value: 'claude-3-5-sonnet-20241022',
          short: 'Sonnet 3.5'
        },
        {
          name: 'Claude Haiku 3 - Fastest, most affordable',
          value: 'claude-3-haiku-20240307',
          short: 'Haiku 3'
        }
      ],
      default: 'claude-opus-4'
    }
  ]);

  return {
    apiKey: answers.apiKey.trim(),
    model: answers.model
  };
}

/**
 * Configure Vertex AI provider
 */
async function configureVertexAI(): Promise<VertexAIConfig> {
  console.log(chalk.bold('\n☁️  Google Cloud Vertex AI Configuration'));
  console.log(chalk.dim('Vertex AI lets you use Claude through your GCP account\n'));

  const { authType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'authType',
      message: 'Select authentication method:',
      choices: [
        {
          name: 'Service Account JSON file',
          value: 'service-account',
          short: 'Service Account'
        },
        {
          name: 'Application Default Credentials (ADC)',
          value: 'adc',
          short: 'ADC'
        }
      ],
      default: 'service-account'
    }
  ]);

  const baseAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectId',
      message: 'Enter your GCP project ID:',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Project ID is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'location',
      message: 'Enter GCP region:',
      default: 'us-central1',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Location is required';
        }
        return true;
      }
    }
  ]);

  let serviceAccountPath: string | undefined;
  let credentials: any;

  if (authType === 'service-account') {
    const { saPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'saPath',
        message: 'Enter path to service account JSON file:',
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Path is required';
          }

          const fullPath = input.startsWith('~')
            ? path.join(process.env.HOME || '', input.slice(1))
            : path.resolve(input);

          if (!fs.existsSync(fullPath)) {
            return `File not found: ${fullPath}`;
          }

          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            JSON.parse(content);
            return true;
          } catch {
            return 'Invalid JSON file';
          }
        }
      }
    ]);

    serviceAccountPath = saPath.startsWith('~')
      ? path.join(process.env.HOME || '', saPath.slice(1))
      : path.resolve(saPath);
  } else {
    console.log(chalk.dim('\nUsing Application Default Credentials'));
    console.log(chalk.dim('Make sure you have run: gcloud auth application-default login'));
  }

  const { model } = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Select Claude model:',
      choices: [
        {
          name: 'Claude 3 Opus - Most capable',
          value: 'claude-3-opus@20240229',
          short: 'Opus'
        },
        {
          name: 'Claude 3 Sonnet - Balanced',
          value: 'claude-3-sonnet@20240229',
          short: 'Sonnet'
        },
        {
          name: 'Claude 3 Haiku - Fastest',
          value: 'claude-3-haiku@20240307',
          short: 'Haiku'
        }
      ],
      default: 'claude-3-opus@20240229'
    }
  ]);

  return {
    projectId: baseAnswers.projectId.trim(),
    location: baseAnswers.location.trim(),
    authType,
    serviceAccountPath,
    credentials,
    model
  };
}

/**
 * Show current configuration
 */
export async function showConfig() {
  const config = ConfigManager.load();

  if (!config || Object.keys(config.providers).length === 0) {
    console.log(chalk.yellow('\n⚠️  No configuration found'));
    console.log(chalk.dim('   Run: dsb config'));
    return;
  }

  console.log(chalk.bold('\n🎨 Design System Builder Configuration\n'));

  console.log(chalk.bold('Default Provider:'));
  console.log(`  ${config.defaultProvider}`);

  console.log(chalk.bold('\nConfigured Providers:'));
  for (const provider of Object.keys(config.providers)) {
    console.log(`  ✓ ${provider}`);
  }

  console.log(chalk.bold('\nPreferences:'));
  console.log(`  Show cost estimates: ${config.preferences.showCostEstimates}`);
  console.log(`  Output directory: ${config.preferences.outputDir}`);
  console.log(`  Analytics: ${config.preferences.analytics}`);

  console.log(chalk.dim(`\nConfig file: ${ConfigManager.getConfigPath()}`));
}
EOFCLI

# Create CLI main index
echo -e "${BLUE}Creating packages/cli/src/index.ts${NC}"
cat > packages/cli/src/index.ts << 'EOF'
#!/usr/bin/env node

/**
 * Design System Builder CLI
 *
 * Main entry point for the dsb command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { configCommand, showConfig } from './commands/config';

const program = new Command();

program
  .name('dsb')
  .description('Design System Builder - Extract design systems from any website using AI')
  .version('0.1.0');

// Config command
program
  .command('config')
  .description('Configure AI provider credentials')
  .option('-p, --provider <provider>', 'Select provider (anthropic, vertex-ai)')
  .option('-r, --reset', 'Reset all configuration')
  .action(configCommand);

// Show config
program
  .command('show')
  .description('Show current configuration')
  .action(showConfig);

// Extract command (placeholder for now)
program
  .command('extract <url>')
  .description('Extract design system from a website')
  .option('-o, --output <dir>', 'Output directory')
  .option('-p, --provider <provider>', 'Override default provider')
  .action((url, options) => {
    console.log(chalk.yellow('\n🚧 Extract command coming soon!'));
    console.log(chalk.dim(`   Will extract design system from: ${url}`));
    if (options.output) {
      console.log(chalk.dim(`   Output to: ${options.output}`));
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
EOF

echo -e "${GREEN}✓ CLI package complete${NC}"
echo ""

# Create documentation files
echo -e "${BLUE}Creating QUICKSTART.md${NC}"
cat > QUICKSTART.md << 'EOF'
# Quick Start Guide

Get started with Design System Builder in 5 minutes.

## Step 1: Install Dependencies

```bash
cd /Users/rishabhpatel/design-system-builder
npm install
```

## Step 2: Build

```bash
npm run build
```

## Step 3: Link CLI for Development

```bash
cd packages/cli
npm link
```

Now you can use `dsb` command globally.

## Step 4: Configure Your Provider

### Option A: Anthropic (Recommended for getting started)

1. Get an API key from https://console.anthropic.com/settings/keys
2. Run the config command:

```bash
dsb config
```

3. Select "Anthropic (Direct API)"
4. Paste your API key when prompted
5. Choose your model (Claude Opus 4 recommended)

### Option B: Google Cloud Vertex AI

1. Create a GCP project and enable Vertex AI API
2. Create a service account with "Vertex AI User" role
3. Download the service account JSON key
4. Run the config command:

```bash
dsb config
```

5. Select "Google Cloud Vertex AI"
6. Enter your project ID and region
7. Select "Service Account JSON file"
8. Enter the path to your JSON key file

## Step 5: Verify Configuration

```bash
dsb show
```

You should see your configured provider and preferences.

## Step 6: Next Steps

The extraction engine is coming soon! It will:

1. **Capture Screenshots** - Use Playwright to screenshot all pages
2. **Analyze with AI** - Send to Claude Vision API for analysis
3. **Extract Design System** - Identify tokens, components, patterns
4. **Validate with Code** - Cross-reference with HTML/CSS inspection
5. **Export W3C Format** - Generate standard design token files

## 📚 Learn More

- [README.md](./README.md) - Full documentation
- [SETUP.md](./SETUP.md) - Standalone setup guide
- [STATUS.md](./STATUS.md) - Current status and architecture
EOF

echo -e "${BLUE}Creating STATUS.md${NC}"
cat > STATUS.md << 'EOF'
# Design System Builder - Status

## ✅ Complete (v0.1.0)

### Foundation
- [x] Standalone npm package structure
- [x] Multi-provider abstraction layer
- [x] Anthropic provider implementation
- [x] Vertex AI provider implementation
- [x] Provider factory pattern
- [x] Secure config management (AES-256-GCM)
- [x] Interactive CLI with Inquirer
- [x] Configuration validation
- [x] BYOK (Bring Your Own Key) model
- [x] Privacy-first architecture

### Files Created
- Root: package.json, tsconfig.json, README.md, .gitignore
- Providers: types.ts, anthropic-provider.ts, vertex-ai-provider.ts, provider-factory.ts, index.ts
- Core: config-manager.ts, index.ts
- CLI: index.ts, commands/config.ts
- Docs: QUICKSTART.md, SETUP.md, STATUS.md

### Lines of Code
- ~1,200 lines of TypeScript
- ~500 lines of documentation

## 🚧 In Progress

### Next: Extraction Engine (v0.2.0)

Create `packages/extractor/` with:
- Screenshot capture (Playwright)
- Component isolation
- State capture (hover, focus, active)
- Network analysis (CSS, fonts)
- Code extraction (HTML, computed styles)

## 📋 Roadmap

### v0.2.0 - Extraction Engine
- [ ] Playwright screenshot capture
- [ ] Claude Vision analysis integration
- [ ] Design token extraction
- [ ] Component identification
- [ ] Pattern detection

### v0.3.0 - Export System
- [ ] W3C DTCG format export
- [ ] Figma Tokens format
- [ ] CSS variables export
- [ ] Tailwind config export
- [ ] Style Dictionary format

### v1.0.0 - Production Ready
- [ ] Full test coverage
- [ ] Documentation site
- [ ] Example gallery
- [ ] Performance optimization
- [ ] Error handling improvements

## 🎯 Architecture

```
design-system-builder/
├── packages/
│   ├── providers/    ✅ Complete
│   ├── core/         ✅ Complete
│   ├── cli/          ✅ Complete
│   ├── extractor/    🚧 Next
│   └── export/       📋 Future
```

## 💡 Key Features

- **BYOK Model** - Users provide API keys
- **Multi-Provider** - Anthropic + Vertex AI support
- **Privacy-First** - All local processing
- **Vision-First** - Claude Vision API for extraction
- **W3C DTCG** - Standard design token format
- **Free & Open Source** - MIT license
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✨ All files created successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Install dependencies:"
echo "   cd /Users/rishabhpatel/design-system-builder"
echo "   npm install"
echo ""
echo "2. Build all packages:"
echo "   npm run build"
echo ""
echo "3. Link CLI for development:"
echo "   cd packages/cli"
echo "   npm link"
echo ""
echo "4. Configure your provider:"
echo "   dsb config"
echo ""
echo "5. Verify setup:"
echo "   dsb show"
echo ""
echo -e "${GREEN}🎉 Design System Builder is ready!${NC}"
EOF

chmod +x /Users/rishabhpatel/design-system-builder/setup-files.sh
echo "✅ Setup script created successfully!"
echo ""
echo "📍 Location: /Users/rishabhpatel/design-system-builder/setup-files.sh"
echo ""
echo "🚀 Run it with:"
echo "   bash /Users/rishabhpatel/design-system-builder/setup-files.sh"
