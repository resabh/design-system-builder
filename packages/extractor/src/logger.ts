/**
 * Structured logging for extraction engine
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Simple structured logger
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix: string = '', level?: LogLevel) {
    this.prefix = prefix;
    this.level = level !== undefined ? level : this.getLogLevelFromEnv();
  }

  /**
   * Get log level from environment variable
   */
  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'ERROR':
        return LogLevel.ERROR;
      case 'WARN':
        return LogLevel.WARN;
      case 'INFO':
        return LogLevel.INFO;
      case 'DEBUG':
        return LogLevel.DEBUG;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * Create a child logger with additional prefix
   */
  child(prefix: string): Logger {
    return new Logger(
      this.prefix ? `${this.prefix}:${prefix}` : prefix,
      this.level
    );
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext | Error): void {
    if (this.level >= LogLevel.ERROR) {
      this.log(LogLevel.ERROR, message, context);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    if (this.level >= LogLevel.WARN) {
      this.log(LogLevel.WARN, message, context);
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    if (this.level >= LogLevel.INFO) {
      this.log(LogLevel.INFO, message, context);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    if (this.level >= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext | Error): void {
    const entry: LogEntry = {
      level,
      message: this.prefix ? `[${this.prefix}] ${message}` : message,
      timestamp: new Date().toISOString()
    };

    // Handle Error objects
    if (context instanceof Error) {
      entry.error = {
        name: context.name,
        message: context.message,
        stack: context.stack
      };
    } else if (context) {
      entry.context = context;
    }

    // Format output based on level
    const levelName = LogLevel[level];
    const prefix = this.getColoredPrefix(level);

    if (level === LogLevel.ERROR) {
      console.error(prefix, this.formatEntry(entry));
    } else if (level === LogLevel.WARN) {
      console.warn(prefix, this.formatEntry(entry));
    } else {
      console.log(prefix, this.formatEntry(entry));
    }
  }

  /**
   * Get colored prefix for log level
   */
  private getColoredPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return '❌ ERROR:';
      case LogLevel.WARN:
        return '⚠️  WARN:';
      case LogLevel.INFO:
        return 'ℹ️  INFO:';
      case LogLevel.DEBUG:
        return '🔍 DEBUG:';
      default:
        return '';
    }
  }

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    const parts: string[] = [entry.message];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context, null, 2));
    }

    if (entry.error) {
      parts.push(`Error: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(entry.error.stack);
      }
    }

    return parts.join('\n');
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger('dsb');

/**
 * Create a logger for a specific component
 */
export function createLogger(component: string): Logger {
  return logger.child(component);
}
