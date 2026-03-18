/**
 * Code inspection - HTML structure and CSS styles extraction
 */

import type { Page } from 'playwright';
import type { HTMLStructure, StylesAnalysis, ComponentElement, HierarchyNode, ElementStyles } from './types';

export class CodeInspector {
  /**
   * Extract HTML structure from the page
   */
  async extractHTML(page: Page): Promise<HTMLStructure> {
    // Identify components
    const components = await this.identifyComponents(page);

    // Get DOM hierarchy
    const hierarchy = await this.parseHierarchy(page);

    return {
      components,
      hierarchy
    };
  }

  /**
   * Extract computed CSS styles from key elements
   */
  async extractStyles(page: Page): Promise<StylesAnalysis> {
    const elements = await page.evaluate(() => {
      // Select common UI elements
      const selectors = [
        'button',
        'a[class*="button" i]',
        'a[class*="btn" i]',
        '[role="button"]',
        'input[type="text"]',
        'input[type="email"]',
        'input[type="password"]',
        'input[type="search"]',
        'textarea',
        'select',
        '[class*="card" i]',
        'article',
        'nav',
        'header',
        'footer',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p',
        'a'
      ];

      const result: any[] = [];
      const processedElements = new Set<Element>();

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);

        // Limit to first 3 of each type to avoid overwhelming data
        const limited = Array.from(elements).slice(0, 3);

        limited.forEach((el) => {
          if (processedElements.has(el)) return;
          processedElements.add(el);

          const computed = window.getComputedStyle(el);

          // Build a specific selector for this element
          let specificSelector = selector;
          if (el.id) {
            specificSelector = `#${el.id}`;
          } else if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
              specificSelector = `${el.tagName.toLowerCase()}.${classes[0]}`;
            }
          }

          result.push({
            selector: specificSelector,
            styles: {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              fontSize: computed.fontSize,
              fontFamily: computed.fontFamily,
              fontWeight: computed.fontWeight,
              lineHeight: computed.lineHeight,
              padding: computed.padding,
              margin: computed.margin,
              borderRadius: computed.borderRadius,
              boxShadow: computed.boxShadow,
              border: computed.border,
              display: computed.display,
              gap: computed.gap
            }
          });
        });
      }

      return result;
    });

    return { elements };
  }

  /**
   * Identify component elements on the page
   */
  private async identifyComponents(page: Page): Promise<ComponentElement[]> {
    const components = await page.evaluate(() => {
      const componentMap: Record<string, string> = {
        'button': 'button',
        'a[class*="button" i]': 'button',
        'a[class*="btn" i]': 'button',
        '[role="button"]': 'button',
        'input[type="text"]': 'text-input',
        'input[type="email"]': 'email-input',
        'input[type="password"]': 'password-input',
        'input[type="search"]': 'search-input',
        'input[type="checkbox"]': 'checkbox',
        'input[type="radio"]': 'radio',
        'textarea': 'textarea',
        'select': 'select',
        '[class*="card" i]': 'card',
        'article': 'card',
        'nav': 'navigation',
        '[role="navigation"]': 'navigation',
        'header': 'header',
        'footer': 'footer'
      };

      const result: any[] = [];
      const seen = new Set<Element>();

      for (const [selector, type] of Object.entries(componentMap)) {
        const elements = document.querySelectorAll(selector);

        elements.forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);

          const classes = el.className && typeof el.className === 'string'
            ? el.className.split(' ').filter(c => c.trim())
            : [];

          result.push({
            selector: el.id ? `#${el.id}` : selector,
            type,
            tagName: el.tagName.toLowerCase(),
            classNames: classes,
            role: el.getAttribute('role') || undefined
          });
        });
      }

      return result;
    });

    return components;
  }

  /**
   * Parse DOM hierarchy
   */
  private async parseHierarchy(page: Page): Promise<HierarchyNode> {
    const hierarchy = await page.evaluate(() => {
      function buildNode(element: Element, maxDepth: number = 3, currentDepth: number = 0): any {
        if (currentDepth >= maxDepth) {
          return null;
        }

        const classes = element.className && typeof element.className === 'string'
          ? element.className.split(' ').filter(c => c.trim())
          : [];

        const children: any[] = [];

        // Only process significant children
        const significantChildren = Array.from(element.children).filter(child => {
          const tag = child.tagName.toLowerCase();
          // Skip script, style, etc.
          return !['script', 'style', 'noscript', 'meta', 'link'].includes(tag);
        });

        // Limit children to avoid huge trees
        significantChildren.slice(0, 10).forEach(child => {
          const childNode = buildNode(child, maxDepth, currentDepth + 1);
          if (childNode) {
            children.push(childNode);
          }
        });

        return {
          tag: element.tagName.toLowerCase(),
          classes,
          children
        };
      }

      const body = document.body;
      return buildNode(body, 3, 0);
    });

    return hierarchy || { tag: 'body', classes: [], children: [] };
  }
}
