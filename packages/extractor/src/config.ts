/**
 * Configuration management with environment variable support
 */

export interface Config {
  browser: {
    timeout: number;
    viewport: { width: number; height: number };
    headless: boolean;
  };
  capture: {
    maxComponents: number;
    maxStates: number;
    captureStates: boolean;
  };
  api: {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
  };
  limits: {
    maxPageSize: number;
    maxCost: number;
  };
  logging: {
    level: string;
  };
}

export const DEFAULT_CONFIG: Config = {
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
  },
  limits: {
    maxPageSize: 10 * 1024 * 1024, // 10MB
    maxCost: 1.0 // $1.00
  },
  logging: {
    level: 'info'
  }
} as const;

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  return {
    browser: {
      timeout: parseInt(process.env.DSB_BROWSER_TIMEOUT || String(DEFAULT_CONFIG.browser.timeout)),
      viewport: {
        width: parseInt(process.env.DSB_VIEWPORT_WIDTH || String(DEFAULT_CONFIG.browser.viewport.width)),
        height: parseInt(process.env.DSB_VIEWPORT_HEIGHT || String(DEFAULT_CONFIG.browser.viewport.height))
      },
      headless: process.env.DSB_HEADLESS !== 'false'
    },
    capture: {
      maxComponents: parseInt(process.env.DSB_MAX_COMPONENTS || String(DEFAULT_CONFIG.capture.maxComponents)),
      maxStates: parseInt(process.env.DSB_MAX_STATES || String(DEFAULT_CONFIG.capture.maxStates)),
      captureStates: process.env.DSB_CAPTURE_STATES === 'true'
    },
    api: {
      maxRetries: parseInt(process.env.DSB_MAX_RETRIES || String(DEFAULT_CONFIG.api.maxRetries)),
      retryDelay: parseInt(process.env.DSB_RETRY_DELAY || String(DEFAULT_CONFIG.api.retryDelay)),
      timeout: parseInt(process.env.DSB_API_TIMEOUT || String(DEFAULT_CONFIG.api.timeout))
    },
    limits: {
      maxPageSize: parseInt(process.env.DSB_MAX_PAGE_SIZE || String(DEFAULT_CONFIG.limits.maxPageSize)),
      maxCost: parseFloat(process.env.DSB_MAX_COST || String(DEFAULT_CONFIG.limits.maxCost))
    },
    logging: {
      level: process.env.LOG_LEVEL || DEFAULT_CONFIG.logging.level
    }
  };
}

/**
 * Get config value with fallback
 */
export function getConfig<T>(path: string, defaultValue: T): T {
  const config = loadConfig();
  const keys = path.split('.');
  let value: any = config;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }

  return value !== undefined ? value : defaultValue;
}
