/**
 * Extract command - Extract design system from a URL
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { DesignSystemExtractor } from '@dsb/extractor';
import { ProviderFactory, ProviderType } from '@dsb/providers';
import { ConfigManager } from '@dsb/core';

export interface ExtractOptions {
  output?: string;
  provider?: string;
  captureStates?: boolean;
}

export async function extractCommand(url: string, options: ExtractOptions) {
  console.log(chalk.bold('\n🎨 Design System Extractor\n'));

  // Validate URL
  if (!isValidUrl(url)) {
    console.error(chalk.red('❌ Invalid URL. Please provide a valid HTTP/HTTPS URL.'));
    return;
  }

  // Get provider configuration
  let providerName: ProviderType;
  let providerConfig: any;

  if (options.provider) {
    // Use specified provider
    if (!ProviderFactory.isSupported(options.provider)) {
      console.error(chalk.red(`❌ Unsupported provider: ${options.provider}`));
      console.log(chalk.dim(`   Supported providers: ${ProviderFactory.getSupportedProviders().join(', ')}`));
      return;
    }
    providerName = options.provider as ProviderType;
    providerConfig = ConfigManager.getProvider(providerName);

    if (!providerConfig) {
      console.error(chalk.red(`❌ Provider '${providerName}' not configured.`));
      console.log(chalk.dim(`   Run: ${chalk.cyan('dsb config --provider ' + providerName)}`));
      return;
    }
  } else {
    // Use default provider
    const defaultProvider = ConfigManager.getDefaultProvider();

    if (!defaultProvider) {
      console.error(chalk.red('❌ No provider configured.'));
      console.log(chalk.dim(`   Run: ${chalk.cyan('dsb config')} to set up a provider`));
      return;
    }

    providerName = defaultProvider.provider as ProviderType;
    providerConfig = defaultProvider.config;
  }

  // Initialize provider
  const spinner = ora('Initializing AI provider...').start();

  try {
    const provider = await ProviderFactory.initialize(providerName, providerConfig);

    spinner.succeed(`Using ${chalk.cyan(providerName)} provider`);

    // Create extractor
    const extractor = new DesignSystemExtractor(provider, {
      viewport: { width: 1920, height: 1080 },
      captureStates: options.captureStates || false,
      maxComponents: 20,
      timeout: 30000
    });

    // Extract design system
    spinner.text = 'Launching browser...';
    spinner.start();

    const designSystem = await extractor.extract(url);

    spinner.succeed('Design system extracted!');

    // Determine output path
    const outputPath = options.output || './design-system.json';
    const resolvedPath = path.resolve(outputPath);

    // Ensure output directory exists
    const outputDir = path.dirname(resolvedPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save to file
    fs.writeFileSync(resolvedPath, JSON.stringify(designSystem, null, 2));

    // Display summary
    console.log(chalk.green('\n✅ Design system extraction complete!\n'));
    console.log(chalk.bold('Summary:'));
    console.log(`   ${chalk.dim('Source:')}        ${url}`);
    console.log(`   ${chalk.dim('Output:')}        ${resolvedPath}`);
    console.log(`   ${chalk.dim('Provider:')}      ${providerName}`);
    console.log('');

    // Token counts
    const tokenCount = Object.keys(designSystem.tokens.color).length +
      Object.keys(designSystem.tokens.typography).length +
      Object.keys(designSystem.tokens.spacing).length +
      Object.keys(designSystem.tokens.shadow).length +
      Object.keys(designSystem.tokens.borderRadius).length;

    console.log(chalk.bold('Extracted:'));
    console.log(`   ${chalk.cyan(tokenCount.toString())} design tokens`);
    console.log(`   ${chalk.cyan(designSystem.components.length.toString())} components`);
    console.log(`   ${chalk.cyan(designSystem.patterns.length.toString())} patterns`);
    console.log('');

    // Cost information
    console.log(chalk.bold('Cost:'));
    console.log(`   ${chalk.dim('Input tokens:')}  ${designSystem.metadata.tokenUsage.inputTokens.toLocaleString()}`);
    console.log(`   ${chalk.dim('Output tokens:')} ${designSystem.metadata.tokenUsage.outputTokens.toLocaleString()}`);
    console.log(`   ${chalk.dim('Total cost:')}    ${chalk.yellow('$' + designSystem.metadata.cost.toFixed(4))}`);
    console.log('');

    // Token breakdown
    if (tokenCount > 0) {
      console.log(chalk.bold('Token Breakdown:'));
      if (Object.keys(designSystem.tokens.color).length > 0) {
        console.log(`   ${chalk.dim('Colors:')}        ${Object.keys(designSystem.tokens.color).length}`);
      }
      if (Object.keys(designSystem.tokens.typography).length > 0) {
        console.log(`   ${chalk.dim('Typography:')}    ${Object.keys(designSystem.tokens.typography).length}`);
      }
      if (Object.keys(designSystem.tokens.spacing).length > 0) {
        console.log(`   ${chalk.dim('Spacing:')}       ${Object.keys(designSystem.tokens.spacing).length}`);
      }
      if (Object.keys(designSystem.tokens.shadow).length > 0) {
        console.log(`   ${chalk.dim('Shadows:')}       ${Object.keys(designSystem.tokens.shadow).length}`);
      }
      if (Object.keys(designSystem.tokens.borderRadius).length > 0) {
        console.log(`   ${chalk.dim('Border Radius:')} ${Object.keys(designSystem.tokens.borderRadius).length}`);
      }
      console.log('');
    }

    console.log(chalk.dim(`Open ${chalk.cyan(resolvedPath)} to view the full design system.\n`));
  } catch (error: any) {
    spinner.fail('Extraction failed');
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));

    if (error.message.includes('Browser')) {
      console.log(chalk.dim('💡 Tip: Make sure Playwright is installed:'));
      console.log(chalk.cyan('   npm install -g playwright'));
      console.log(chalk.cyan('   npx playwright install chromium\n'));
    }

    if (error.message.includes('timeout')) {
      console.log(chalk.dim('💡 Tip: The page took too long to load. Try again or use a simpler page.\n'));
    }
  }
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}
