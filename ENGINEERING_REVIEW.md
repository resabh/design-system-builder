# Engineering Review: Design System Extractor

## Executive Summary

This codebase was built quickly to demonstrate functionality. While it **works**, it lacks the robustness, testing, and architectural rigor expected in production systems. This review identifies critical gaps and recommended improvements.

**Current Status:** 🟡 Functional prototype, NOT production-ready

---

## Critical Issues (Must Fix Before Production)

### 1. Zero Test Coverage ❌

**Current State:**
- 0 unit tests
- 0 integration tests
- 0 E2E tests
- No test fixtures
- Manual testing only

**What a Senior Dev Would Do:**

```typescript
// packages/extractor/src/__tests__/screenshot-capture.test.ts
import { ScreenshotCapture } from '../screenshot-capture';
import { Page } from 'playwright';

describe('ScreenshotCapture', () => {
  let mockPage: jest.Mocked<Page>;
  let capture: ScreenshotCapture;

  beforeEach(() => {
    mockPage = createMockPage();
    capture = new ScreenshotCapture({
      viewport: { width: 1920, height: 1080 },
      maxComponents: 20
    });
  });

  describe('capture()', () => {
    it('should capture full page screenshot', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from('mock-screenshot'));

      const screenshots = await capture.capture(mockPage);

      expect(screenshots).toHaveLength(1);
      expect(screenshots[0].type).toBe('full-page');
      expect(screenshots[0].buffer).toBeInstanceOf(Buffer);
    });

    it('should respect maxComponents limit', async () => {
      mockPage.evaluate.mockResolvedValue(createMockComponents(50));
      capture = new ScreenshotCapture({ maxComponents: 10 });

      const screenshots = await capture.capture(mockPage);
      const componentScreenshots = screenshots.filter(s => s.type === 'component');

      expect(componentScreenshots.length).toBeLessThanOrEqual(10);
    });

    it('should handle screenshot failures gracefully', async () => {
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot timeout'));

      await expect(capture.capture(mockPage)).rejects.toThrow();
    });
  });
});

// Integration test with real browser
describe('ScreenshotCapture (integration)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should capture screenshots from real page', async () => {
    page = await browser.newPage();
    await page.goto('https://example.com');

    const capture = new ScreenshotCapture({ maxComponents: 5 });
    const screenshots = await capture.capture(page);

    expect(screenshots.length).toBeGreaterThan(0);
    expect(screenshots[0].buffer.length).toBeGreaterThan(0);
  });
});
```

**Impact:** High - Cannot confidently refactor or deploy without tests

---

### 2. Weak Error Handling ⚠️

**Current Issues:**

```typescript
// vision-analyzer.ts:166-175
} catch (error) {
  // If parsing fails, return empty structure
  console.error('Failed to parse vision analysis:', error);
  return {
    tokens: { colors: [], typography: [], ... },
    components: [],
    patterns: []
  };
}
```

**Problems:**
- Silently swallows errors and returns empty data
- User gets charged for API call but gets no results
- No way to distinguish between "no tokens found" vs "parsing failed"
- No structured error types
- `console.error` in library code (should use logger)

**What a Senior Dev Would Do:**

```typescript
// src/errors.ts
export class VisionAnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly rawResponse?: string
  ) {
    super(message);
    this.name = 'VisionAnalysisError';
  }
}

export class JSONParseError extends VisionAnalysisError {
  constructor(content: string, cause: Error) {
    super('Failed to parse AI response as JSON', cause, content);
    this.name = 'JSONParseError';
  }
}

// vision-analyzer.ts
private parseAnalysis(content: string): VisionAnalysis {
  try {
    let jsonContent = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonContent);

    // VALIDATE the structure
    if (!parsed.tokens || typeof parsed.tokens !== 'object') {
      throw new VisionAnalysisError(
        'AI response missing required "tokens" field',
        undefined,
        content
      );
    }

    return this.validateAndStructure(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new JSONParseError(content, error);
    }
    throw error;
  }
}

private validateAndStructure(parsed: any): VisionAnalysis {
  // Use a validation library like Zod
  return VisionAnalysisSchema.parse(parsed);
}
```

**Impact:** High - Silent failures lose user money and trust

---

### 3. No Input Validation 🔴

**Current Issues:**

```typescript
// extractor.ts - No validation before expensive operations
async extract(url: string): Promise<DesignSystem> {
  // Immediately launches browser and makes API calls
  // What if URL is malicious?
  // What if page is 100MB?
  // What if it never loads?
}
```

**What a Senior Dev Would Do:**

```typescript
// src/validators.ts
export interface ExtractionLimits {
  maxPageSize: number;        // 10MB
  maxTimeout: number;          // 30s
  maxScreenshots: number;      // 20
  maxAPITokens: number;        // 100k
}

export async function validateUrl(url: string): Promise<ValidationResult> {
  // 1. Valid URL format
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // 2. Allowed protocols (no file://, data:, etc.)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' };
  }

  // 3. Not localhost in production (security risk)
  if (isProduction && isLocalhost(parsed.hostname)) {
    return { valid: false, error: 'Localhost URLs not allowed in production' };
  }

  // 4. HEAD request to check page exists and size
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
    const contentLength = response.headers.get('content-length');

    if (contentLength && parseInt(contentLength) > limits.maxPageSize) {
      return {
        valid: false,
        error: `Page too large: ${contentLength} bytes (max ${limits.maxPageSize})`
      };
    }
  } catch (error) {
    return { valid: false, error: `URL not accessible: ${error.message}` };
  }

  return { valid: true };
}

// extractor.ts
async extract(url: string): Promise<DesignSystem> {
  // Validate BEFORE launching browser
  const validation = await validateUrl(url);
  if (!validation.valid) {
    throw new InvalidURLError(validation.error);
  }

  const estimatedCost = this.estimateCost(this.options);
  if (estimatedCost > limits.maxCost) {
    throw new CostLimitError(`Estimated cost $${estimatedCost} exceeds limit`);
  }

  // Now proceed with extraction...
}
```

**Impact:** High - Security risk, DOS risk, bad UX

---

### 4. No Retry Logic ⚠️

Network calls and browser automation are flaky. Current code:

```typescript
// One network blip = entire extraction fails
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
```

**What a Senior Dev Would Do:**

```typescript
// src/utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoff = 2,
    onRetry = () => {}
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = delayMs * Math.pow(backoff, attempt - 1);
      onRetry(attempt, delay, lastError);
      await sleep(delay);
    }
  }

  throw lastError!;
}

// extractor.ts
await withRetry(
  () => page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }),
  {
    maxAttempts: 3,
    delayMs: 2000,
    onRetry: (attempt, delay, error) => {
      this.logger.warn(`Page navigation failed (attempt ${attempt}/3), retrying in ${delay}ms`, error);
    }
  }
);
```

**Impact:** Medium - Reduces reliability on flaky networks

---

### 5. Memory Leaks 🔴

**Current Issues:**

```typescript
// screenshot-capture.ts
const screenshots: Screenshot[] = [];

// Accumulates ALL screenshots in memory
// For a complex page: 1 full page (2MB) + 20 components (40MB) + 10 states (20MB) = 62MB
// This grows unbounded with maxComponents
```

**What a Senior Dev Would Do:**

```typescript
// Use streaming/chunking for large captures
async *captureStream(page: Page): AsyncGenerator<Screenshot> {
  // Yield full page
  yield await this.captureFullPage(page);

  // Yield components one at a time
  const components = await this.findComponents(page);
  for (const selector of components.slice(0, this.options.maxComponents)) {
    const screenshot = await this.captureComponent(page, selector);
    if (screenshot) {
      yield screenshot;
    }
  }
}

// Or write directly to disk
async captureToDisk(page: Page, outputDir: string): Promise<ScreenshotManifest> {
  const fullPagePath = path.join(outputDir, 'full-page.png');
  await page.screenshot({ path: fullPagePath, fullPage: true });

  const manifest = {
    fullPage: fullPagePath,
    components: []
  };

  // Stream components to disk
  const components = await this.findComponents(page);
  for (const [index, selector] of components.entries()) {
    const componentPath = path.join(outputDir, `component-${index}.png`);
    await element.screenshot({ path: componentPath });
    manifest.components.push({ selector, path: componentPath });
  }

  return manifest;
}
```

**Impact:** High - Will crash on large pages

---

### 6. No Observability 📊

**Current Issues:**
- No structured logging
- No metrics
- No tracing
- Can't debug production issues

**What a Senior Dev Would Do:**

```typescript
// src/observability/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// src/observability/metrics.ts
export class Metrics {
  private static metrics = new Map<string, number>();

  static increment(metric: string, value = 1) {
    this.metrics.set(metric, (this.metrics.get(metric) || 0) + value);
  }

  static histogram(metric: string, value: number) {
    // Record histogram
  }

  static summary() {
    return Object.fromEntries(this.metrics);
  }
}

// extractor.ts
async extract(url: string): Promise<DesignSystem> {
  const startTime = Date.now();

  logger.info('Starting extraction', { url, options: this.options });
  Metrics.increment('extraction.started');

  try {
    const browser = await chromium.launch();
    logger.debug('Browser launched');

    const page = await browser.newPage();
    await page.goto(url);
    logger.info('Page loaded', { url, loadTime: Date.now() - startTime });

    const screenshots = await this.screenshotCapture.capture(page);
    Metrics.histogram('screenshots.count', screenshots.length);
    logger.info('Screenshots captured', { count: screenshots.length });

    // ... more logging

    Metrics.increment('extraction.succeeded');
    logger.info('Extraction complete', {
      url,
      totalTime: Date.now() - startTime,
      tokensFound: Object.keys(designSystem.tokens).length
    });

    return designSystem;
  } catch (error) {
    Metrics.increment('extraction.failed');
    logger.error('Extraction failed', { url, error, duration: Date.now() - startTime });
    throw error;
  }
}
```

**Impact:** Medium - Can't debug production issues

---

### 7. Hardcoded Configuration 🔧

**Current Issues:**

```typescript
// Hardcoded timeouts, limits, etc.
timeout: 30000
maxComponents: 20
```

**What a Senior Dev Would Do:**

```typescript
// config/defaults.ts
export const DEFAULT_CONFIG = {
  browser: {
    timeout: 30000,
    viewport: { width: 1920, height: 1080 },
    headless: true
  },
  capture: {
    maxComponents: 20,
    maxStates: 5,
    captureStates: false
  },
  api: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 60000
  }
} as const;

// Allow environment variable overrides
export function loadConfig(): Config {
  return {
    browser: {
      timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
      viewport: {
        width: parseInt(process.env.VIEWPORT_WIDTH || '1920'),
        height: parseInt(process.env.VIEWPORT_HEIGHT || '1080')
      },
      headless: process.env.HEADLESS !== 'false'
    },
    // ...
  };
}
```

---

## Architectural Issues

### 1. Tight Coupling

```typescript
// extractor.ts directly creates all dependencies
this.screenshotCapture = new ScreenshotCapture(this.options);
this.visionAnalyzer = new VisionAnalyzer(this.provider);
```

**Better: Dependency Injection**

```typescript
export interface ExtractorDependencies {
  screenshotCapture: IScreenshotCapture;
  visionAnalyzer: IVisionAnalyzer;
  codeInspector: ICodeInspector;
  networkAnalyzer: INetworkAnalyzer;
  designSystemBuilder: IDesignSystemBuilder;
  logger: ILogger;
}

export class DesignSystemExtractor {
  constructor(
    private deps: ExtractorDependencies,
    private options: ExtractorOptions
  ) {}

  // Now easy to mock in tests!
}
```

### 2. No Plugin System

What if users want to:
- Add custom component detectors?
- Use different AI providers?
- Export to different formats?

**Should have:**

```typescript
export interface ExtractorPlugin {
  name: string;
  beforeExtract?(context: ExtractionContext): Promise<void>;
  afterScreenshot?(screenshot: Screenshot): Promise<Screenshot>;
  afterExtract?(designSystem: DesignSystem): Promise<DesignSystem>;
}

// Usage
const extractor = new DesignSystemExtractor(provider, {
  plugins: [
    new CustomComponentPlugin(),
    new FigmaExportPlugin(),
    new SlackNotificationPlugin()
  ]
});
```

### 3. No Caching

Every extraction is from scratch. Should cache:
- Browser downloads (Playwright)
- Common website resources
- AI responses for identical inputs

---

## Missing Features

### 1. Progress Tracking

Current: Silent until done
Should: Stream progress events

```typescript
extractor.on('progress', (event) => {
  console.log(`${event.stage}: ${event.progress}%`);
});
```

### 2. Cost Estimation

Current: Only shows cost AFTER extraction
Should: Show estimate BEFORE

### 3. Incremental Extraction

Current: All-or-nothing
Should: Allow resuming failed extractions

### 4. Comparison/Diff

Should be able to:
```bash
dsb extract https://example.com -o v1.json
# ... site changes ...
dsb extract https://example.com -o v2.json
dsb diff v1.json v2.json  # Show what changed
```

---

## Testing Strategy (Missing)

### What Should Exist:

1. **Unit Tests** (70% coverage target)
   - Each class in isolation
   - Mocked dependencies
   - Edge cases

2. **Integration Tests**
   - Components working together
   - Mocked AI provider
   - Real browser, fake websites

3. **Contract Tests**
   - AI provider response validation
   - Output format validation

4. **E2E Tests**
   - Full extraction on real sites
   - Snapshot testing for outputs
   - Performance benchmarks

5. **Test Fixtures**
   ```
   tests/
     fixtures/
       simple-page/
         index.html
         expected-output.json
       complex-page/
         index.html
         expected-output.json
   ```

---

## What To Do Next

### Priority 1: Critical (Do Immediately)

1. ✅ **Add comprehensive error handling**
   - Custom error types
   - Proper error propagation
   - User-friendly messages

2. ✅ **Add input validation**
   - URL validation
   - Size limits
   - Timeout protection

3. ✅ **Write unit tests** (at least 50% coverage)
   - Start with pure functions
   - Mock external dependencies

### Priority 2: Important (This Week)

4. ✅ **Add structured logging**
   - Winston or Pino
   - Log levels
   - Correlation IDs

5. ✅ **Add retry logic**
   - Network calls
   - Screenshot failures
   - API timeouts

6. ✅ **Memory management**
   - Stream large captures
   - Implement cleanup

### Priority 3: Nice to Have (Next Sprint)

7. **Add integration tests**
8. **Implement plugin system**
9. **Add progress tracking**
10. **Implement caching**

---

## Conclusion

**What we built:** A functional prototype that demonstrates the concept

**What's missing:** Production-grade reliability, testability, and observability

**Time investment needed:**
- Basic quality (tests + errors): 2-3 days
- Production-ready: 1-2 weeks
- Enterprise-grade: 3-4 weeks

**The good news:** The architecture is sound, the code is readable, and the core logic works. These are fixable issues, not fundamental design flaws.

**Recommendation:** Do NOT deploy to production until at least Priority 1 items are complete.
