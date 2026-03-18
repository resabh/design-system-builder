# GitHub Setup Guide

## Step 1: Create GitHub Repository

### Option A: Using GitHub Website (Recommended)

1. **Go to GitHub:**
   - Navigate to https://github.com/new

2. **Repository Settings:**
   ```
   Repository name: design-system-builder
   Description: Extract design systems from any website using AI vision analysis
   Visibility: Public

   ❌ Do NOT initialize with:
      - README (we already have one)
      - .gitignore (we already have one)
      - License (we already have one)
   ```

3. **Click "Create repository"**

### Option B: Install GitHub CLI (Alternative)

```bash
# macOS
brew install gh

# Then authenticate
gh auth login

# Create and push repo
gh repo create design-system-builder --public --source=. --push
```

## Step 2: Add Remote and Push

After creating the repository on GitHub, run these commands:

```bash
# Add remote (replace 'yourusername' with your GitHub username)
git remote add origin https://github.com/yourusername/design-system-builder.git

# Verify remote was added
git remote -v

# Push to GitHub
git push -u origin main
```

## Step 3: Verify on GitHub

After pushing, visit:
```
https://github.com/yourusername/design-system-builder
```

You should see:
- ✅ 26 files
- ✅ README.md displayed
- ✅ MIT License badge
- ✅ All documentation

## Repository Information

### Recommended Settings

**About Section (on GitHub):**
```
Description: Extract design systems from any website using AI vision analysis
Website: (leave empty for now)
Topics: design-system, design-tokens, ai, claude, anthropic, vertex-ai,
        typescript, cli-tool, byok, w3c-dtcg
```

**Features to Enable:**
- ✅ Issues
- ✅ Discussions (optional)
- ❌ Wiki (we have docs in repo)
- ❌ Projects (not needed yet)

### Branch Protection (Optional)

For `main` branch:
- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ✅ Require branches to be up to date

(Can be configured later as the project grows)

## Quick Copy-Paste Commands

**Replace `yourusername` with your actual GitHub username:**

```bash
# Add remote
git remote add origin https://github.com/yourusername/design-system-builder.git

# Push to GitHub
git push -u origin main
```

## Troubleshooting

### Error: "remote origin already exists"

```bash
# Remove old remote
git remote remove origin

# Add correct remote
git remote add origin https://github.com/yourusername/design-system-builder.git
```

### Error: "Permission denied (publickey)"

You need to set up SSH keys or use HTTPS with token:

**Using HTTPS (easier):**
```bash
git remote set-url origin https://github.com/yourusername/design-system-builder.git
git push -u origin main
# Enter GitHub username and Personal Access Token when prompted
```

**Using SSH (recommended):**
1. Generate SSH key: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
2. Use SSH URL: `git@github.com:yourusername/design-system-builder.git`

## After Pushing

### Add Repository Badges

Add these to the top of README.md:

```markdown
# Design System Builder

[![npm version](https://badge.fury.io/js/design-system-builder.svg)](https://www.npmjs.com/package/design-system-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
```

### Next Steps

1. **Enable GitHub Actions** (for CI/CD)
2. **Create CONTRIBUTING.md**
3. **Set up npm publishing workflow**
4. **Add issue templates**
5. **Create project roadmap**

## Ready to Publish to npm

After GitHub setup:

```bash
# Update package.json
# Change: "name": "design-system-builder"
# To: "name": "@yourusername/design-system-builder"

# Login to npm
npm login

# Publish
npm publish --access public
```
