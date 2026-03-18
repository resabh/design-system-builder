/**
 * Input validation utilities for safe extraction
 */

import * as path from 'path';
import * as fs from 'fs';
import { InvalidURLError, PageSizeLimitError, ValidationError } from './errors';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ExtractionLimits {
  /** Maximum page size in bytes (default: 10MB) */
  maxPageSize: number;
  /** Maximum timeout in milliseconds (default: 30s) */
  maxTimeout: number;
  /** Maximum screenshots to capture (default: 50) */
  maxScreenshots: number;
  /** Maximum estimated cost in USD (default: $1.00) */
  maxCost: number;
}

export const DEFAULT_LIMITS: ExtractionLimits = {
  maxPageSize: 10 * 1024 * 1024, // 10MB
  maxTimeout: 30000, // 30s
  maxScreenshots: 50,
  maxCost: 1.0 // $1.00
};

/**
 * Validate URL format and safety
 */
export function validateURLFormat(url: string): ValidationResult {
  // 1. Valid URL format
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format. Must be a valid HTTP or HTTPS URL.'
    };
  }

  // 2. Allowed protocols only
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      valid: false,
      error: `Protocol '${parsed.protocol}' not allowed. Only HTTP and HTTPS are supported.`
    };
  }

  // 3. Block dangerous protocols (XSS, file access, data injection)
  const dangerousProtocols = ['file:', 'data:', 'javascript:', 'vbscript:', 'about:'];
  if (dangerousProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      error: `Protocol '${parsed.protocol}' is blocked for security reasons.`
    };
  }

  // 4. Check for localhost/internal IPs in production
  if (isProduction() && isLocalhost(parsed.hostname)) {
    return {
      valid: false,
      error: 'Localhost and internal network URLs are not allowed in production.'
    };
  }

  return { valid: true };
}

/**
 * Validate URL is accessible and within size limits
 */
export async function validateURLAccessibility(
  url: string,
  limits: ExtractionLimits = DEFAULT_LIMITS
): Promise<ValidationResult> {
  try {
    // Make HEAD request to check accessibility and size
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    // Check response status
    if (!response.ok) {
      return {
        valid: false,
        error: `URL returned ${response.status} ${response.statusText}`
      };
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > limits.maxPageSize) {
        return {
          valid: false,
          error: `Page size ${formatBytes(size)} exceeds limit of ${formatBytes(limits.maxPageSize)}`
        };
      }
    }

    return { valid: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          valid: false,
          error: 'URL request timed out after 5 seconds'
        };
      }
      return {
        valid: false,
        error: `Failed to access URL: ${error.message}`
      };
    }
    return {
      valid: false,
      error: 'Unknown error while validating URL accessibility'
    };
  }
}

/**
 * Comprehensive URL validation
 */
export async function validateURL(
  url: string,
  limits: ExtractionLimits = DEFAULT_LIMITS
): Promise<void> {
  // Format validation
  const formatResult = validateURLFormat(url);
  if (!formatResult.valid) {
    throw new InvalidURLError(formatResult.error!, url);
  }

  // Accessibility validation
  const accessResult = await validateURLAccessibility(url, limits);
  if (!accessResult.valid) {
    throw new InvalidURLError(accessResult.error!, url);
  }
}

/**
 * Validate extractor options
 */
export function validateExtractorOptions(options: any): ValidationResult {
  if (options.viewport) {
    if (typeof options.viewport.width !== 'number' || options.viewport.width <= 0) {
      return {
        valid: false,
        error: 'viewport.width must be a positive number'
      };
    }
    if (typeof options.viewport.height !== 'number' || options.viewport.height <= 0) {
      return {
        valid: false,
        error: 'viewport.height must be a positive number'
      };
    }
    // Upper bounds to prevent DoS via huge viewport sizes
    if (options.viewport.width > 7680) { // 8K width
      return {
        valid: false,
        error: 'viewport.width cannot exceed 7680 pixels'
      };
    }
    if (options.viewport.height > 4320) { // 8K height
      return {
        valid: false,
        error: 'viewport.height cannot exceed 4320 pixels'
      };
    }
  }

  if (options.maxComponents !== undefined) {
    if (typeof options.maxComponents !== 'number' || options.maxComponents < 0) {
      return {
        valid: false,
        error: 'maxComponents must be a non-negative number'
      };
    }
  }

  if (options.timeout !== undefined) {
    if (typeof options.timeout !== 'number' || options.timeout <= 0) {
      return {
        valid: false,
        error: 'timeout must be a positive number'
      };
    }
  }

  return { valid: true };
}

/**
 * Check if running in production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if hostname is localhost or internal IP
 */
function isLocalhost(hostname: string): boolean {
  const localhostPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./
  ];

  return localhostPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return hostname === pattern;
    }
    return pattern.test(hostname);
  });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Estimate cost based on extraction options
 */
export function estimateCost(options: {
  maxComponents?: number;
  captureStates?: boolean;
}): number {
  // Base cost for full page analysis
  const baseCost = 0.02;

  // Add cost per component (rough estimate)
  const componentCount = options.maxComponents !== undefined ? Math.min(options.maxComponents, 20) : 20;
  const componentCost = componentCount * 0.002;

  // Add cost for state capture
  const stateCost = options.captureStates ? componentCount * 0.005 : 0;

  return baseCost + componentCost + stateCost;
}

/**
 * Validate output file path for security and safety
 */
export function validateOutputPath(outputPath: string, options: {
  allowOverwrite?: boolean;
  baseDirectory?: string;
} = {}): ValidationResult {
  // 1. Resolve to absolute path
  const absolutePath = path.resolve(outputPath);

  // 2. Check for path traversal attacks
  if (options.baseDirectory) {
    const baseDir = path.resolve(options.baseDirectory);
    if (!absolutePath.startsWith(baseDir)) {
      return {
        valid: false,
        error: `Output path '${outputPath}' attempts to write outside allowed directory`
      };
    }
  }

  // 3. Check for null bytes (path traversal attempt)
  if (outputPath.includes('\0')) {
    return {
      valid: false,
      error: 'Output path contains invalid null byte'
    };
  }

  // 4. Check for dangerous parent directory references
  const normalized = path.normalize(outputPath);
  if (normalized.includes('..')) {
    return {
      valid: false,
      error: 'Output path cannot contain parent directory references (..)'
    };
  }

  // 5. Validate file extension
  const ext = path.extname(outputPath).toLowerCase();
  const allowedExtensions = ['.json', '.txt', '.md'];
  if (ext && !allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Output file extension '${ext}' not allowed. Allowed: ${allowedExtensions.join(', ')}`
    };
  }

  // 6. Check if file exists (overwrite protection)
  if (!options.allowOverwrite && fs.existsSync(absolutePath)) {
    return {
      valid: false,
      error: `Output file '${absolutePath}' already exists. Use --force to overwrite.`
    };
  }

  // 7. Check if directory exists and is writable
  const directory = path.dirname(absolutePath);
  if (!fs.existsSync(directory)) {
    try {
      fs.mkdirSync(directory, { recursive: true });
    } catch (error) {
      return {
        valid: false,
        error: `Cannot create output directory '${directory}'`
      };
    }
  }

  try {
    fs.accessSync(directory, fs.constants.W_OK);
  } catch (error) {
    return {
      valid: false,
      error: `Output directory '${directory}' is not writable`
    };
  }

  return { valid: true };
}
