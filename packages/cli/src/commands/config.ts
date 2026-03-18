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
