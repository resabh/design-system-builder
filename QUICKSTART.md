# Quick Start Guide

Get started with Design System Builder in 5 minutes.

## Step 1: Install Dependencies

```bash
cd /Users/rishabhpatel/design-system-builder
npm install
```

## Step 2: Build

```bash
npm run build
```

## Step 3: Link CLI for Development

```bash
cd packages/cli
npm link
```

Now you can use `dsb` command globally.

## Step 4: Configure Your Provider

### Option A: Anthropic (Recommended for getting started)

1. Get an API key from https://console.anthropic.com/settings/keys
2. Run the config command:

```bash
dsb config
```

3. Select "Anthropic (Direct API)"
4. Paste your API key when prompted
5. Choose your model (Claude Opus 4 recommended)

### Option B: Google Cloud Vertex AI

1. Create a GCP project and enable Vertex AI API
2. Create a service account with "Vertex AI User" role
3. Download the service account JSON key
4. Run the config command:

```bash
dsb config
```

5. Select "Google Cloud Vertex AI"
6. Enter your project ID and region
7. Select "Service Account JSON file"
8. Enter the path to your JSON key file

## Step 5: Verify Configuration

```bash
dsb show
```

You should see your configured provider and preferences.

## Step 6: Next Steps

The extraction engine is coming soon! It will:

1. **Capture Screenshots** - Use Playwright to screenshot all pages
2. **Analyze with AI** - Send to Claude Vision API for analysis
3. **Extract Design System** - Identify tokens, components, patterns
4. **Validate with Code** - Cross-reference with HTML/CSS inspection
5. **Export W3C Format** - Generate standard design token files

## 📚 Learn More

- [README.md](./README.md) - Full documentation
- [SETUP.md](./SETUP.md) - Standalone setup guide
- [STATUS.md](./STATUS.md) - Current status and architecture
