# Design System Builder

Extract design systems from any website using AI vision analysis.

## 🎯 What It Does

Design System Builder analyzes live websites and extracts:
- **Design Tokens** - Colors, typography, spacing, shadows
- **Components** - Buttons, inputs, cards, navigation
- **Patterns** - Common UI patterns and layouts
- **Templates** - Page templates and structures
- **Usage Guidelines** - How components are used in context

## 🚀 Features

- **Vision-First Extraction** - Uses Claude's vision API to analyze screenshots
- **Multi-Source Validation** - Combines visual analysis with code inspection
- **BYOK (Bring Your Own Key)** - Use your own Anthropic or Vertex AI credentials
- **Privacy-First** - All processing happens locally on your machine
- **Multi-Provider** - Supports Anthropic direct API and Google Cloud Vertex AI
- **W3C DTCG Format** - Exports design tokens in standard format

## 📦 Installation

```bash
npm install -g design-system-builder
```

### Requirements

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **Playwright** (installed automatically)

After installation, install the Chromium browser for Playwright:

```bash
npx playwright install chromium
```

This is a one-time setup that downloads a compatible version of Chromium (~100MB).

## 🔧 Setup

Configure your AI provider credentials:

```bash
dsb config
```

This will guide you through:
1. Selecting your provider (Anthropic or Vertex AI)
2. Entering your credentials
3. Validating access
4. Saving encrypted configuration

### Anthropic Setup

You'll need an Anthropic API key from https://console.anthropic.com/settings/keys

### Vertex AI Setup

You'll need:
- GCP project ID
- GCP region (e.g., `us-central1`)
- Service account JSON with Vertex AI User role

## 📖 Usage

### Extract a Design System

Basic extraction (outputs to `./design-system.json`):

```bash
dsb extract https://example.com
```

### Command Options

```bash
dsb extract <url> [options]

Options:
  -o, --output <file>        Output file path (default: ./design-system.json)
  -p, --provider <provider>  Override default provider (anthropic, vertex-ai)
  --capture-states           Capture component state variations (hover, focus)
```

### Examples

Extract with custom output path:

```bash
dsb extract https://stripe.com -o ./stripe-design-system.json
```

Extract with component state variations:

```bash
dsb extract https://github.com --capture-states
```

Use a specific provider:

```bash
dsb extract https://example.com --provider vertex-ai
```

### Show Current Configuration

```bash
dsb show
```

### Output Format

The extracted design system is saved as JSON with the following structure:

```json
{
  "tokens": {
    "color": { "primary": "#0066CC", "secondary": "#6C757D", ... },
    "typography": { "heading-1": { "fontFamily": "Inter", ... }, ... },
    "spacing": { "sm": "8px", "md": "16px", ... },
    "shadow": { "sm": "0 1px 2px rgba(0,0,0,0.1)", ... },
    "borderRadius": { "md": "8px", ... }
  },
  "components": [
    {
      "name": "Button",
      "type": "button",
      "description": "Primary interactive element",
      "variants": [...],
      "styles": { ... }
    }
  ],
  "patterns": [
    {
      "name": "8px Grid System",
      "type": "spacing",
      "description": "Consistent spacing scale",
      "examples": ["8px", "16px", "24px", "32px"]
    }
  ],
  "metadata": {
    "sourceUrl": "https://example.com",
    "extractedAt": "2024-03-18T19:30:00.000Z",
    "provider": "anthropic",
    "cost": 0.0234,
    "tokenUsage": { "inputTokens": 12000, "outputTokens": 3000 }
  }
}
```

## 🏗️ How It Works

The extraction engine uses a **multi-source analysis approach**:

### 1. Browser Automation (Playwright)
- Launches headless Chromium browser
- Navigates to target URL
- Captures full-page screenshots
- Identifies and captures individual components (buttons, inputs, cards, etc.)
- Optionally captures component states (hover, focus, active)

### 2. Visual Analysis (Claude Vision API)
- Sends screenshots to Claude Vision API
- Extracts design tokens (colors, typography, spacing, shadows, border radius)
- Identifies component variants and patterns
- Detects visual hierarchy and consistency

### 3. Code Inspection
- Extracts HTML structure and DOM hierarchy
- Captures computed CSS styles for all elements
- Gets exact values for colors, fonts, spacing, etc.
- Identifies component types and semantic structure

### 4. Network Monitoring
- Captures CSS files loaded by the page
- Identifies font resources (WOFF2, TTF, etc.)
- Detects design token files (JSON/CSS variables)

### 5. AI Synthesis
- Combines all sources using Claude
- Resolves conflicts (prefers code analysis for accuracy)
- Normalizes values (e.g., `rgb(0, 102, 204)` → `#0066CC`)
- Generates unified design system with tokens, components, and patterns

### 6. Export
- Outputs W3C DTCG-compatible JSON
- Includes metadata (cost, token usage, timestamp)
- Provides detailed extraction summary

## 💰 Cost

Design System Builder is **free and open source**. You only pay for:
- API usage to Anthropic or Google Cloud (BYOK model)
- Typical cost: **$0.02-0.05 per page** for basic extraction
- With `--capture-states`: **$0.10-0.30 per page** (captures more screenshots)
- Exact cost displayed after each extraction
- Token usage breakdown provided for transparency

**Cost Factors:**
- Number of screenshots captured (full page + components)
- Complexity of the page (more components = more screenshots)
- Whether state variations are captured (`--capture-states` flag)
- AI model used (Claude Sonnet for balance of quality and cost)

## 🔒 Privacy

- All processing happens locally on your machine
- No data sent to Design System Builder servers
- API keys encrypted and stored locally in `~/.dsb/config.json`
- No telemetry or usage tracking (unless you opt-in)

## 📚 Architecture

Design System Builder uses a monorepo structure:

```
design-system-builder/
├── packages/
│   ├── providers/    # AI provider abstraction (Anthropic, Vertex AI)
│   ├── core/         # Config management, encryption
│   ├── extractor/    # Design system extraction engine
│   │   ├── screenshot-capture.ts    # Playwright browser automation
│   │   ├── vision-analyzer.ts       # Claude Vision API integration
│   │   ├── code-inspector.ts        # HTML/CSS extraction
│   │   ├── network-analyzer.ts      # Resource monitoring
│   │   ├── design-system-builder.ts # AI synthesis
│   │   └── extractor.ts             # Main orchestrator
│   └── cli/          # Command-line interface
```

### Key Components

- **providers** - Abstraction layer supporting Anthropic API and Google Cloud Vertex AI
- **core** - Configuration management with AES-256-GCM encryption for API keys
- **extractor** - Multi-source extraction engine combining visual AI, code analysis, and network monitoring
- **cli** - Interactive command-line interface with progress tracking and cost transparency

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Watch mode
npm run watch
```

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

## 🐛 Issues

Report issues at: https://github.com/resabh/design-system-builder/issues
