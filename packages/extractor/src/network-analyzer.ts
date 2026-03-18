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

  /**
   * Capture network resources from the page
   */
  async captureResources(page: Page): Promise<NetworkResources> {
    // Reset resources
    this.resources = {
      css: [],
      fonts: [],
      designTokens: []
    };

    // Set up response listener
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Capture CSS files
        if (url.endsWith('.css') || contentType.includes('text/css')) {
          try {
            const content = await response.text();
            this.resources.css.push({ url, content });
          } catch (error) {
            // Skip if we can't read the response
          }
        }

        // Capture font files
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
        // Skip any errors in response handling
      }
    });

    // Return a promise that resolves after a short delay
    // This allows time for resources to be captured
    await new Promise(resolve => setTimeout(resolve, 1000));

    return this.resources;
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
