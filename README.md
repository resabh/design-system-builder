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

```bash
dsb extract https://example.com
```

### Specify Output Directory

```bash
dsb extract https://example.com --output ./my-design-system
```

### Use Different Provider

```bash
dsb extract https://example.com --provider vertex-ai
```

### Show Current Configuration

```bash
dsb show
```

## 🏗️ How It Works

1. **Capture** - Takes screenshots of the website using Playwright
2. **Analyze** - Uses Claude Vision API to identify design patterns
3. **Extract** - Extracts design tokens, components, and patterns
4. **Validate** - Cross-references with code inspection
5. **Export** - Generates W3C DTCG format design system

## 💰 Cost

Design System Builder is **free and open source**. You only pay for:
- API usage to Anthropic or Google Cloud
- Typical cost: $0.10-0.50 per page analyzed
- Real-time cost estimates shown before operations

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
│   ├── cli/          # Command-line interface
│   ├── extractor/    # Design system extraction engine (coming soon)
│   └── export/       # W3C DTCG format export (coming soon)
```

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

Report issues at: https://github.com/yourusername/design-system-builder/issues
