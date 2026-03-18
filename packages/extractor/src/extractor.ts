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
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      // Launch browser
      browser = await chromium.launch({
        headless: true
      });

      // Create page with viewport
      page = await browser.newPage({
        viewport: this.options.viewport
      });

      // Set up network analyzer before navigation
      await this.networkAnalyzer.captureResources(page);

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.options.timeout
      });

      // Wait a bit for any lazy-loaded content
      await page.waitForTimeout(2000);

      // Capture all sources in parallel
      const [screenshots, htmlStructure, styles] = await Promise.all([
        this.screenshotCapture.capture(page),
        this.codeInspector.extractHTML(page),
        this.codeInspector.extractStyles(page)
      ]);

      // Get network resources
      const networkResources = this.networkAnalyzer.getResources();

      // Analyze screenshots with vision API
      const visionAnalysis = await this.visionAnalyzer.analyze(screenshots);

      // Aggregate all sources
      const allSources: AllSources = {
        visionAnalysis,
        htmlStructure,
        styles,
        networkResources
      };

      // Build final design system
      const designSystem = await this.designSystemBuilder.build(allSources, url);

      return designSystem;
    } catch (error) {
      throw new Error(`Failed to extract design system: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clean up
      if (page) {
        await page.close();
      }
      if (browser) {
        await browser.close();
      }
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
