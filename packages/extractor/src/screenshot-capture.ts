/**
 * Screenshot capture using Playwright
 */

import type { Page } from 'playwright';
import type { Screenshot, ExtractorOptions } from './types';

export class ScreenshotCapture {
  constructor(private options: ExtractorOptions) {}

  /**
   * Capture screenshots from a page
   */
  async capture(page: Page): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];

    // Capture full page screenshot
    const fullPageScreenshot = await this.captureFullPage(page);
    screenshots.push(fullPageScreenshot);

    // Find and capture component screenshots
    const components = await this.findComponents(page);
    const componentLimit = this.options.maxComponents || 20;

    for (const selector of components.slice(0, componentLimit)) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            const screenshot = await this.captureComponent(page, element, selector);
            if (screenshot) {
              screenshots.push(screenshot);
            }
          }
        }
      } catch (error) {
        // Skip components that can't be captured
        console.debug(`Skipping component ${selector}: ${error}`);
      }
    }

    // Capture state variations if enabled
    if (this.options.captureStates) {
      const stateScreenshots = await this.captureStates(page, components.slice(0, 5));
      screenshots.push(...stateScreenshots);
    }

    return screenshots;
  }

  /**
   * Capture full page screenshot
   */
  private async captureFullPage(page: Page): Promise<Screenshot> {
    const viewport = page.viewportSize() || this.options.viewport || { width: 1920, height: 1080 };

    const buffer = await page.screenshot({
      fullPage: true,
      type: 'png'
    });

    return {
      type: 'full-page',
      buffer,
      viewport
    };
  }

  /**
   * Capture a single component screenshot
   */
  private async captureComponent(
    page: Page,
    element: any,
    selector: string
  ): Promise<Screenshot | null> {
    try {
      const bounds = await element.boundingBox();
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        return null;
      }

      const buffer = await element.screenshot({ type: 'png' });
      const viewport = page.viewportSize() || this.options.viewport;

      return {
        type: 'component',
        buffer,
        component: selector,
        bounds,
        viewport,
        state: 'default'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Find common UI components on the page
   */
  private async findComponents(page: Page): Promise<string[]> {
    const selectors: string[] = [];

    // Common component selectors
    const componentQueries = [
      // Buttons
      'button',
      'a[class*="button" i]',
      'a[class*="btn" i]',
      '[role="button"]',

      // Inputs
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      'input[type="search"]',
      'textarea',
      'select',

      // Forms
      'input[type="checkbox"]',
      'input[type="radio"]',

      // Cards
      '[class*="card" i]',
      'article',

      // Navigation
      'nav',
      '[role="navigation"]',
      'header',
      'footer',

      // Lists
      'ul[class*="menu" i]',
      'ul[class*="nav" i]',

      // Other common components
      '[class*="modal" i]',
      '[class*="dialog" i]',
      '[class*="dropdown" i]',
      '[class*="accordion" i]',
      '[class*="tab" i]'
    ];

    // Evaluate in browser context to get actual elements
    const foundSelectors = await page.evaluate((queries) => {
      const found: string[] = [];
      const seen = new Set<Element>();

      for (const query of queries) {
        const elements = document.querySelectorAll(query);
        elements.forEach((el) => {
          if (!seen.has(el)) {
            seen.add(el);
            // Create a more specific selector if possible
            let selector = query;
            if (el.id) {
              selector = `#${el.id}`;
            } else if (el.className && typeof el.className === 'string') {
              const classes = el.className.split(' ').filter(c => c.trim());
              if (classes.length > 0) {
                selector = `${el.tagName.toLowerCase()}.${classes[0]}`;
              }
            }
            found.push(selector);
          }
        });
      }

      return found;
    }, componentQueries);

    return foundSelectors;
  }

  /**
   * Capture component state variations (hover, focus, etc.)
   */
  private async captureStates(page: Page, components: string[]): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];

    for (const selector of components) {
      try {
        const element = await page.$(selector);
        if (!element) continue;

        // Only capture states for interactive elements
        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
        if (!['button', 'a', 'input', 'select', 'textarea'].includes(tagName)) {
          continue;
        }

        // Hover state
        try {
          await element.hover();
          await page.waitForTimeout(200); // Wait for transitions
          const hoverBuffer = await element.screenshot({ type: 'png' });
          const bounds = await element.boundingBox();

          if (bounds) {
            screenshots.push({
              type: 'state',
              buffer: hoverBuffer,
              component: selector,
              state: 'hover',
              bounds,
              viewport: page.viewportSize() || this.options.viewport
            });
          }
        } catch (error) {
          // Skip if hover fails
        }

        // Focus state (for inputs and buttons)
        if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
          try {
            await element.focus();
            await page.waitForTimeout(200);
            const focusBuffer = await element.screenshot({ type: 'png' });
            const bounds = await element.boundingBox();

            if (bounds) {
              screenshots.push({
                type: 'state',
                buffer: focusBuffer,
                component: selector,
                state: 'focus',
                bounds,
                viewport: page.viewportSize() || this.options.viewport
              });
            }
          } catch (error) {
            // Skip if focus fails
          }
        }
      } catch (error) {
        // Skip components that fail
        continue;
      }
    }

    return screenshots;
  }
}
