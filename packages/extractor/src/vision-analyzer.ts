/**
 * Vision analysis using AI providers
 */

import type { LLMProvider } from '@dsb/providers';
import type { Screenshot, VisionAnalysis } from './types';
import { VisionAnalysisError, JSONParseError, InvalidResponseError } from './errors';
import { createLogger } from './logger';
import { withRetry, API_RETRY_OPTIONS } from './retry';
import { RateLimiter } from './rate-limiter';

const logger = createLogger('vision-analyzer');

export class VisionAnalyzer {
  constructor(
    private provider: LLMProvider,
    private rateLimiter?: RateLimiter
  ) {}

  /**
   * Analyze screenshots to extract design system information
   */
  async analyze(screenshots: Screenshot[]): Promise<VisionAnalysis> {
    logger.info('Starting vision analysis', {
      totalScreenshots: screenshots.length,
      types: screenshots.map(s => s.type)
    });

    // Build comprehensive prompt
    const prompt = this.buildPrompt(screenshots);

    // Prepare images (limit to most important ones to manage costs)
    const images = this.selectImportantScreenshots(screenshots);

    logger.info('Selected screenshots for analysis', {
      selected: images.length,
      total: screenshots.length
    });

    // Check rate limit before API call
    if (this.rateLimiter) {
      await this.rateLimiter.checkAndWait();
    }

    // Send to AI provider with retry logic and timeout
    const response = await this.withTimeout(
      withRetry(
        () => this.provider.analyzeImage({
          images: images.map(s => s.buffer),
          prompt,
          maxTokens: 4096
        }),
        {
          ...API_RETRY_OPTIONS,
          onRetry: (attempt, delay, error) => {
            logger.warn(`Vision API call failed, retrying (attempt ${attempt})`, {
              delay,
              error: error.message
            });
          }
        }
      ),
      60000 // 60 second timeout (configurable via DSB_API_TIMEOUT)
    );

    // Track cost after successful API call
    if (this.rateLimiter) {
      const cost = this.provider.calculateCost(response.usage);
      this.rateLimiter.addCost(cost);

      logger.debug('API cost tracked', {
        requestCost: cost,
        totalSessionCost: this.rateLimiter.getTotalCost()
      });
    }

    logger.debug('Received AI response', {
      contentLength: response.content.length,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens
    });

    // Parse the JSON response
    const analysis = this.parseAnalysis(response.content);

    logger.info('Vision analysis complete', {
      tokensFound: {
        colors: analysis.tokens.colors.length,
        typography: analysis.tokens.typography.length,
        spacing: analysis.tokens.spacing.length
      },
      components: analysis.components.length,
      patterns: analysis.patterns.length
    });

    return analysis;
  }

  /**
   * Build the prompt for vision analysis
   */
  private buildPrompt(screenshots: Screenshot[]): string {
    const screenshotTypes = screenshots.map(s => s.type).join(', ');

    return `You are analyzing a website's design system. You will receive ${screenshots.length} screenshots (${screenshotTypes}).

Your task is to extract a comprehensive design system including:

1. DESIGN TOKENS
   - Colors: Identify primary, secondary, accent, neutral colors, and semantic colors (success, error, warning, info)
   - Typography: Font families, sizes, weights, line heights, letter spacing
   - Spacing: Margins, paddings, gaps (identify the spacing scale if present, e.g., 4px, 8px, 16px, 24px, 32px)
   - Shadows: Box shadows and elevation levels
   - Border Radius: Identify corner radius values and patterns

2. COMPONENTS
   - Buttons: Identify all button variants (primary, secondary, text, outline, etc.) and sizes (small, medium, large)
   - Inputs: Text inputs, textareas, selects, checkboxes, radio buttons
   - Cards: Identify card components with their structure and spacing
   - Navigation: Headers, footers, sidebars, menus
   - Other UI components you can identify

3. PATTERNS
   - Layout patterns: Grid systems, container widths, spacing patterns
   - Color usage patterns: How colors are used across the site
   - Typography hierarchy: Heading levels, body text variations
   - Spacing consistency: Common margin/padding values

IMPORTANT:
- Extract EXACT values when visible (hex colors, pixel sizes, specific font names)
- Provide specific token names that follow common conventions (e.g., "primary-500", "spacing-md", "shadow-lg")
- For components, identify all visible variants and states
- Look for consistency and patterns in the design

Output your analysis as a JSON object with this EXACT structure:

\`\`\`json
{
  "tokens": {
    "colors": [
      { "name": "primary", "value": "#0066CC", "usage": "Primary buttons, links", "variant": "500" }
    ],
    "typography": [
      { "name": "heading-1", "fontFamily": "Inter", "fontSize": "32px", "fontWeight": "700", "lineHeight": "1.2" }
    ],
    "spacing": [
      { "name": "spacing-1", "value": "4px", "usage": "Tight spacing" }
    ],
    "shadows": [
      { "name": "shadow-sm", "value": "0 1px 2px rgba(0,0,0,0.1)", "usage": "Cards, buttons" }
    ],
    "borderRadius": [
      { "name": "radius-md", "value": "8px", "usage": "Buttons, cards" }
    ]
  },
  "components": [
    {
      "type": "button",
      "name": "Primary Button",
      "description": "Main call-to-action button",
      "variants": ["primary", "secondary", "outline"],
      "styles": {
        "backgroundColor": "#0066CC",
        "color": "#FFFFFF",
        "padding": "12px 24px",
        "borderRadius": "8px"
      }
    }
  ],
  "patterns": [
    {
      "type": "spacing",
      "description": "Consistent 8px spacing scale",
      "examples": ["4px", "8px", "16px", "24px", "32px", "48px"]
    }
  ]
}
\`\`\`

Be thorough and extract as much detail as possible. Only output valid JSON.`;
  }

  /**
   * Select the most important screenshots to analyze
   * (to manage API costs and token limits)
   */
  private selectImportantScreenshots(screenshots: Screenshot[]): Screenshot[] {
    // Always include full-page screenshot
    const fullPage = screenshots.filter(s => s.type === 'full-page');

    // Include component screenshots (limit to 10 most important)
    const components = screenshots
      .filter(s => s.type === 'component')
      .slice(0, 10);

    // Include a few state screenshots (limit to 5)
    const states = screenshots
      .filter(s => s.type === 'state')
      .slice(0, 5);

    return [...fullPage, ...components, ...states];
  }

  /**
   * Parse the AI response into structured VisionAnalysis
   */
  private parseAnalysis(content: string): VisionAnalysis {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
        logger.debug('Extracted JSON from markdown code block');
      }

      // Parse the JSON
      let parsed: any;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (parseError) {
        logger.error('Failed to parse AI response as JSON', {
          contentPreview: content.substring(0, 200),
          error: parseError
        });
        throw new JSONParseError(content, parseError as Error);
      }

      // Validate required structure
      if (!parsed.tokens || typeof parsed.tokens !== 'object') {
        logger.error('AI response missing required "tokens" field', { parsed });
        throw new InvalidResponseError(
          'AI response must include a "tokens" object',
          parsed
        );
      }

      // Validate and structure the response
      const analysis: VisionAnalysis = {
        tokens: {
          colors: Array.isArray(parsed.tokens.colors) ? parsed.tokens.colors : [],
          typography: Array.isArray(parsed.tokens.typography) ? parsed.tokens.typography : [],
          spacing: Array.isArray(parsed.tokens.spacing) ? parsed.tokens.spacing : [],
          shadows: Array.isArray(parsed.tokens.shadows) ? parsed.tokens.shadows : [],
          borderRadius: Array.isArray(parsed.tokens.borderRadius) ? parsed.tokens.borderRadius : []
        },
        components: Array.isArray(parsed.components) ? parsed.components : [],
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : []
      };

      // Warn if no data extracted
      const totalTokens = Object.values(analysis.tokens).reduce((sum, arr) => sum + arr.length, 0);
      if (totalTokens === 0 && analysis.components.length === 0) {
        logger.warn('Vision analysis returned no tokens or components');
      }

      return analysis;
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof VisionAnalysisError) {
        throw error;
      }

      // Wrap unexpected errors
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Unexpected error during vision analysis parsing', err);
      throw new VisionAnalysisError(
        'Failed to parse vision analysis',
        err,
        content
      );
    }
  }

  /**
   * Wrap a promise with a timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`API call timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}
