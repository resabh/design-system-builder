/**
 * Main design system extractor
 */

import { chromium, Browser, Page } from 'playwright';
import type { LLMProvider } from '@dsb/providers';
import type { ExtractorOptions, DesignSystem, AllSources } from './types';
import { ScreenshotCapture } from './screenshot-capture';
import { VisionAnalyzer } from './vision-analyzer';
import { CodeInspector } from './code-inspector';
import { NetworkAnalyzer } from './network-analyzer';
import { DesignSystemBuilder } from './design-system-builder';
import { validateURL, validateExtractorOptions, estimateCost, DEFAULT_LIMITS } from './validators';
import { ExtractionError, BrowserTimeoutError } from './errors';
import { createLogger } from './logger';
import { withRetry, BROWSER_RETRY_OPTIONS } from './retry';

const logger = createLogger('extractor');

export class DesignSystemExtractor {
  private screenshotCapture: ScreenshotCapture;
  private visionAnalyzer: VisionAnalyzer;
  private codeInspector: CodeInspector;
  private networkAnalyzer: NetworkAnalyzer;
  private designSystemBuilder: DesignSystemBuilder;

  constructor(
    private provider: LLMProvider,
    private options: ExtractorOptions = {}
  ) {
    // Set default options
    this.options = {
      viewport: { width: 1920, height: 1080 },
      captureStates: false,
      maxComponents: 20,
      outputFormat: 'w3c-dtcg',
      timeout: 30000,
      ...options
    };

    // Validate options
    const validation = validateExtractorOptions(this.options);
    if (!validation.valid) {
      throw new ExtractionError(validation.error!, 'INVALID_OPTIONS');
    }

    logger.debug('Initializing extractor with options', this.options);

    // Initialize components
    this.screenshotCapture = new ScreenshotCapture(this.options);
    this.visionAnalyzer = new VisionAnalyzer(this.provider);
    this.codeInspector = new CodeInspector();
    this.networkAnalyzer = new NetworkAnalyzer();
    this.designSystemBuilder = new DesignSystemBuilder(this.provider);
  }

  /**
   * Extract design system from a URL
   */
  async extract(url: string): Promise<DesignSystem> {
    const startTime = Date.now();
    logger.info('Starting design system extraction', { url });

    // Validate URL BEFORE launching browser
    logger.debug('Validating URL');
    await validateURL(url, DEFAULT_LIMITS);

    // Estimate cost
    const estimatedCost = estimateCost(this.options);
    logger.info('Estimated extraction cost', { cost: estimatedCost });

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      // Launch browser
      logger.debug('Launching browser');
      browser = await chromium.launch({
        headless: true
      });
      logger.debug('Browser launched successfully');

      // Create page with viewport
      page = await browser.newPage({
        viewport: this.options.viewport
      });

      // Set up network analyzer BEFORE navigation (starts listeners)
      await this.networkAnalyzer.captureResources(page);

      // Navigate to URL with retry logic
      logger.info('Navigating to URL', { url });
      await withRetry(
        () => page!.goto(url, {
          waitUntil: 'networkidle',
          timeout: this.options.timeout
        }),
        {
          ...BROWSER_RETRY_OPTIONS,
          onRetry: (attempt, delay, error) => {
            logger.warn(`Navigation failed, retrying (attempt ${attempt})`, {
              delay,
              error: error.message
            });
          }
        }
      );
      logger.info('Page loaded successfully');

      // Wait a bit for any lazy-loaded content
      await page.waitForTimeout(2000);

      // Finish network capture (waits for pending responses)
      await this.networkAnalyzer.finishCapture(3000); // 3s timeout for pending resources

      // Capture all sources in parallel
      logger.info('Capturing page data');
      const [screenshots, htmlStructure, styles] = await Promise.all([
        this.screenshotCapture.capture(page),
        this.codeInspector.extractHTML(page),
        this.codeInspector.extractStyles(page)
      ]);

      logger.debug('Data capture complete', {
        screenshots: screenshots.length,
        components: htmlStructure.components.length,
        styles: styles.elements.length
      });

      // Get captured network resources
      const networkResources = this.networkAnalyzer.getResources();

      // Analyze screenshots with vision API
      logger.info('Analyzing with AI');
      const visionAnalysis = await this.visionAnalyzer.analyze(screenshots);

      // Aggregate all sources
      const allSources: AllSources = {
        visionAnalysis,
        htmlStructure,
        styles,
        networkResources
      };

      // Build final design system
      logger.info('Building final design system');
      const designSystem = await this.designSystemBuilder.build(allSources, url);

      const duration = Date.now() - startTime;
      logger.info('Extraction complete', {
        duration,
        tokensExtracted: Object.keys(designSystem.tokens.color || {}).length +
                         Object.keys(designSystem.tokens.typography || {}).length +
                         Object.keys(designSystem.tokens.spacing || {}).length,
        components: designSystem.components.length,
        patterns: designSystem.patterns.length,
        cost: designSystem.metadata.cost
      });

      return designSystem;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Extraction failed', {
        url,
        duration,
        error
      });

      // Re-throw known errors
      if (error instanceof ExtractionError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ExtractionError(
        `Failed to extract design system: ${error instanceof Error ? error.message : String(error)}`,
        'EXTRACTION_FAILED',
        { url, originalError: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      // Clean up resources - each operation isolated to prevent cascade failures
      logger.debug('Cleaning up resources');

      // Close page first (separate try-catch to ensure browser cleanup runs even if this fails)
      if (page) {
        try {
          await page.close();
          logger.debug('Page closed successfully');
        } catch (pageError) {
          logger.warn('Failed to close page', {
            error: pageError instanceof Error ? pageError.message : String(pageError)
          });
          // Continue to browser cleanup even if page close fails
        }
      }

      // Close browser (guaranteed to run even if page.close() threw)
      if (browser) {
        try {
          await browser.close();
          logger.debug('Browser closed successfully');
        } catch (browserError) {
          logger.error('Failed to close browser - possible memory leak', {
            error: browserError instanceof Error ? browserError.message : String(browserError)
          });
          // Log as error since browser leak is critical
        }
      }

      logger.debug('Cleanup complete');
    }
  }

  /**
   * Validate provider is ready
   */
  async validateProvider(): Promise<boolean> {
    try {
      return await this.provider.validate();
    } catch (error) {
      return false;
    }
  }
}
