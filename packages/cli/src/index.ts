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
