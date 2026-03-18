/**
 * Design system synthesis - combine all sources into final DesignSystem
 */

import type { LLMProvider, TokenUsage } from '@dsb/providers';
import type { AllSources, DesignSystem, DesignTokens, Component, Pattern } from './types';

export class DesignSystemBuilder {
  constructor(private provider: LLMProvider) {}

  /**
   * Build a unified design system from all sources
   */
  async build(sources: AllSources, sourceUrl: string): Promise<DesignSystem> {
    // Synthesize using AI
    const synthesisResult = await this.synthesize(sources);

    // Calculate cost
    const cost = this.provider.calculateCost(synthesisResult.usage);

    // Build final design system
    const designSystem: DesignSystem = {
      tokens: synthesisResult.tokens,
      components: synthesisResult.components,
      patterns: synthesisResult.patterns,
      metadata: {
        sourceUrl,
        extractedAt: new Date().toISOString(),
        provider: this.provider.name,
        cost,
        tokenUsage: {
          inputTokens: synthesisResult.usage.inputTokens,
          outputTokens: synthesisResult.usage.outputTokens
        }
      }
    };

    return designSystem;
  }

  /**
   * Synthesize all sources using AI
   */
  private async synthesize(sources: AllSources): Promise<{
    tokens: DesignTokens;
    components: Component[];
    patterns: Pattern[];
    usage: TokenUsage;
  }> {
    const prompt = this.buildSynthesisPrompt(sources);

    // Call AI provider (no images needed for synthesis)
    const response = await this.provider.analyzeImage({
      images: [],
      prompt,
      maxTokens: 8192
    });

    // Parse the response
    const parsed = this.parseSynthesisResponse(response.content);

    return {
      ...parsed,
      usage: response.usage
    };
  }

  /**
   * Build synthesis prompt combining all sources
   */
  private buildSynthesisPrompt(sources: AllSources): string {
    return `You are a design system expert. Your task is to synthesize a complete, unified design system from multiple sources of data.

You have been provided with:

1. VISION ANALYSIS (from AI analysis of screenshots):
${JSON.stringify(sources.visionAnalysis, null, 2)}

2. CODE ANALYSIS (computed CSS styles from the actual page):
${JSON.stringify(sources.styles, null, 2)}

3. HTML STRUCTURE (component identification):
${JSON.stringify(sources.htmlStructure.components, null, 2)}

4. NETWORK RESOURCES (CSS files, fonts):
- CSS Files: ${sources.networkResources.css.length} files
- Fonts: ${sources.networkResources.fonts.map(f => f.family || f.url).join(', ')}
- Design Token Files: ${sources.networkResources.designTokens.length} files

Your task is to create a unified design system by:

1. MERGING DESIGN TOKENS:
   - Use EXACT values from code analysis when available (these are actual computed styles)
   - Use vision analysis to fill gaps and provide semantic naming
   - Identify patterns and create a cohesive token system
   - Normalize values (e.g., convert "rgb(0, 102, 204)" to "#0066CC")

2. DEFINING COMPONENTS:
   - Combine vision analysis (for variants and descriptions) with code analysis (for exact styles)
   - Create component definitions with clear variants
   - Use actual computed styles as the source of truth for values

3. IDENTIFYING PATTERNS:
   - Look for consistent spacing scales (e.g., 4px, 8px, 16px, 24px)
   - Identify color usage patterns
   - Document layout and typography patterns

Output a JSON object with this structure:

\`\`\`json
{
  "tokens": {
    "color": {
      "primary": "#0066CC",
      "secondary": "#6C757D",
      "background": "#FFFFFF",
      "text": "#212529"
    },
    "typography": {
      "heading-1": {
        "fontFamily": "Inter, sans-serif",
        "fontSize": "32px",
        "fontWeight": "700",
        "lineHeight": "1.2"
      },
      "body": {
        "fontFamily": "Inter, sans-serif",
        "fontSize": "16px",
        "fontWeight": "400",
        "lineHeight": "1.5"
      }
    },
    "spacing": {
      "xs": "4px",
      "sm": "8px",
      "md": "16px",
      "lg": "24px",
      "xl": "32px"
    },
    "shadow": {
      "sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "md": "0 4px 6px rgba(0, 0, 0, 0.1)",
      "lg": "0 10px 15px rgba(0, 0, 0, 0.15)"
    },
    "borderRadius": {
      "sm": "4px",
      "md": "8px",
      "lg": "12px"
    }
  },
  "components": [
    {
      "name": "Button",
      "type": "button",
      "description": "Primary interactive element",
      "variants": [
        {
          "name": "primary",
          "styles": {
            "backgroundColor": "#0066CC",
            "color": "#FFFFFF",
            "padding": "12px 24px",
            "borderRadius": "8px",
            "fontWeight": "600"
          }
        },
        {
          "name": "secondary",
          "styles": {
            "backgroundColor": "#6C757D",
            "color": "#FFFFFF",
            "padding": "12px 24px",
            "borderRadius": "8px",
            "fontWeight": "600"
          }
        }
      ],
      "styles": {
        "padding": "12px 24px",
        "borderRadius": "8px",
        "fontWeight": "600",
        "border": "none",
        "cursor": "pointer"
      }
    }
  ],
  "patterns": [
    {
      "name": "8px Grid System",
      "type": "spacing",
      "description": "All spacing values are multiples of 8px",
      "examples": ["8px", "16px", "24px", "32px", "40px", "48px"]
    }
  ]
}
\`\`\`

Important:
- Prefer code analysis values over vision analysis for accuracy
- Normalize all color values to hex format
- Include only the most important and common components
- Be concise but complete
- Output only valid JSON`;
  }

  /**
   * Parse synthesis response into structured format
   */
  private parseSynthesisResponse(content: string): {
    tokens: DesignTokens;
    components: Component[];
    patterns: Pattern[];
  } {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        tokens: parsed.tokens || this.getDefaultTokens(),
        components: parsed.components || [],
        patterns: parsed.patterns || []
      };
    } catch (error) {
      console.error('Failed to parse synthesis response:', error);
      return {
        tokens: this.getDefaultTokens(),
        components: [],
        patterns: []
      };
    }
  }

  /**
   * Get default empty tokens structure
   */
  private getDefaultTokens(): DesignTokens {
    return {
      color: {},
      typography: {},
      spacing: {},
      shadow: {},
      borderRadius: {}
    };
  }
}
