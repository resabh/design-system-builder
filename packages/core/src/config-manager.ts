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
