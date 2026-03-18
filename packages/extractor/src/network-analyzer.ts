/**
 * Network resource analysis - capture CSS, fonts, and design tokens
 */

import type { Page } from 'playwright';
import type { NetworkResources, CSSResource, FontResource, DesignTokenResource } from './types';

export class NetworkAnalyzer {
  private resources: NetworkResources = {
    css: [],
    fonts: [],
    designTokens: []
  };

  private pendingResponses: Set<Promise<void>> = new Set();
  private maxWaitTime: number = 5000; // Maximum time to wait for resources (configurable)
  private isCapturing: boolean = false;

  /**
   * Start capturing network resources from the page
   * This sets up listeners but doesn't wait - call finishCapture() after page load
   *
   * @param page Playwright page to capture resources from
   */
  async captureResources(page: Page): Promise<void> {
    // Reset resources
    this.resources = {
      css: [],
      fonts: [],
      designTokens: []
    };
    this.pendingResponses.clear();
    this.isCapturing = true;

    // Set up response listener with proper async tracking
    page.on('response', (response) => {
      if (!this.isCapturing) return; // Ignore responses if not actively capturing

      // Create a promise for this response and track it
      const responsePromise = this.handleResponse(response);
      this.pendingResponses.add(responsePromise);

      // Remove from pending when complete
      responsePromise.finally(() => {
        this.pendingResponses.delete(responsePromise);
      });
    });
  }

  /**
   * Finish capture and wait for all pending responses
   *
   * @param maxWaitMs Maximum time to wait for pending responses (default: 5000ms)
   */
  async finishCapture(maxWaitMs: number = 5000): Promise<void> {
    this.maxWaitTime = maxWaitMs;
    this.isCapturing = false; // Stop accepting new responses

    // Wait for all pending responses with timeout
    await this.waitForPendingResponses();
  }

  /**
   * Handle a single response asynchronously
   */
  private async handleResponse(response: any): Promise<void> {
    try {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      // Capture CSS files
      if (url.endsWith('.css') || contentType.includes('text/css')) {
        try {
          const content = await response.text();
          this.resources.css.push({ url, content });
        } catch (error) {
          // Skip if we can't read the response (might be already consumed)
        }
      }

      // Capture font files (no async needed, just metadata)
      if (this.isFontFile(url, contentType)) {
        const family = this.extractFontFamily(url);
        this.resources.fonts.push({ url, family });
      }

      // Check for design token files
      if (this.isDesignTokenFile(url) && contentType.includes('json')) {
        try {
          const content = await response.json();
          this.resources.designTokens.push({ url, content });
        } catch (error) {
          // Skip if not valid JSON
        }
      }
    } catch (error) {
      // Skip any errors in response handling (e.g., response already finished)
    }
  }

  /**
   * Wait for all pending responses to complete, with timeout
   */
  private async waitForPendingResponses(): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (this.pendingResponses.size > 0) {
      const elapsed = Date.now() - startTime;

      // Timeout check
      if (elapsed >= this.maxWaitTime) {
        // Log warning but don't fail - some resources may still be pending
        console.warn(`Network analyzer timeout after ${elapsed}ms with ${this.pendingResponses.size} pending responses`);
        break;
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, checkInterval));

      // Also try to flush any completed promises
      await Promise.race([
        Promise.allSettled(Array.from(this.pendingResponses)),
        new Promise(resolve => setTimeout(resolve, checkInterval))
      ]);
    }
  }

  /**
   * Get captured resources
   */
  getResources(): NetworkResources {
    return this.resources;
  }

  /**
   * Check if URL is a font file
   */
  private isFontFile(url: string, contentType: string): boolean {
    const fontExtensions = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
    const hasFontExtension = fontExtensions.some(ext => url.includes(ext));
    const hasFontContentType = contentType.includes('font');

    return hasFontExtension || hasFontContentType;
  }

  /**
   * Extract font family name from URL
   */
  private extractFontFamily(url: string): string | undefined {
    // Try to extract font family from URL
    // e.g., "https://fonts.googleapis.com/css2?family=Inter:wght@400;700"
    const familyMatch = url.match(/family=([^:&]+)/);
    if (familyMatch) {
      return decodeURIComponent(familyMatch[1]);
    }

    // Try to extract from filename
    const filename = url.split('/').pop()?.split('?')[0];
    if (filename) {
      const nameMatch = filename.match(/^([a-zA-Z]+)/);
      if (nameMatch) {
        return nameMatch[1];
      }
    }

    return undefined;
  }

  /**
   * Check if URL might be a design token file
   */
  private isDesignTokenFile(url: string): boolean {
    const tokenKeywords = [
      'tokens',
      'design-tokens',
      'variables',
      'theme',
      'design-system',
      'styles'
    ];

    const lowerUrl = url.toLowerCase();
    return tokenKeywords.some(keyword => lowerUrl.includes(keyword));
  }
}
