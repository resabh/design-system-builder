/**
 * Vision analysis using AI providers
 */

import type { LLMProvider } from '@dsb/providers';
import type { Screenshot, VisionAnalysis } from './types';

export class VisionAnalyzer {
  constructor(private provider: LLMProvider) {}

  /**
   * Analyze screenshots to extract design system information
   */
  async analyze(screenshots: Screenshot[]): Promise<VisionAnalysis> {
    // Build comprehensive prompt
    const prompt = this.buildPrompt(screenshots);

    // Prepare images (limit to most important ones to manage costs)
    const images = this.selectImportantScreenshots(screenshots);

    // Send to AI provider
    const response = await this.provider.analyzeImage({
      images: images.map(s => s.buffer),
      prompt,
      maxTokens: 4096
    });

    // Parse the JSON response
    const analysis = this.parseAnalysis(response.content);

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
      }

      // Parse the JSON
      const parsed = JSON.parse(jsonContent);

      // Validate and structure the response
      return {
        tokens: {
          colors: parsed.tokens?.colors || [],
          typography: parsed.tokens?.typography || [],
          spacing: parsed.tokens?.spacing || [],
          shadows: parsed.tokens?.shadows || [],
          borderRadius: parsed.tokens?.borderRadius || []
        },
        components: parsed.components || [],
        patterns: parsed.patterns || []
      };
    } catch (error) {
      // If parsing fails, return empty structure
      console.error('Failed to parse vision analysis:', error);
      return {
        tokens: {
          colors: [],
          typography: [],
          spacing: [],
          shadows: [],
          borderRadius: []
        },
        components: [],
        patterns: []
      };
    }
  }
}
