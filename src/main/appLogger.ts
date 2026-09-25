/**
 * Main process logging utility
 *
 * Uses NODE_ENV to determine environment
 * Designed to be easily extensible with external logging services (Sentry, etc.)
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: Date;
  process: 'main';
}

export interface AppLogger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

export interface LoggerProvider {
  log: (entry: LogEntry) => void;
  shouldLog: (level: LogLevel) => boolean;
}

class ConsoleLoggerProvider implements LoggerProvider {
  private minLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  // Safe console logging for main process to prevent EPIPE errors
  private safeConsole = {
    debug: (...args: unknown[]) => {
      try {
        console.debug(...args);
      } catch {
        // Silently ignore EPIPE errors during logging
      }
    },
    info: (...args: unknown[]) => {
      try {
        console.info(...args);
      } catch {
        // Silently ignore EPIPE errors during logging
      }
    },
    warn: (...args: unknown[]) => {
      try {
        console.warn(...args);
      } catch {
        // Silently ignore EPIPE errors during logging
      }
    },
    error: (...args: unknown[]) => {
      try {
        console.error(...args);
      } catch {
        // Silently ignore EPIPE errors during logging
      }
    }
  };

  log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {return;}

    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [main]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        this.safeConsole.debug(`${prefix} 🐛`, entry.message, entry.data || '');
        break;
      case LogLevel.INFO:
        this.safeConsole.info(`${prefix} ℹ️`, entry.message, entry.data || '');
        break;
      case LogLevel.WARN:
        this.safeConsole.warn(`${prefix} ⚠️`, entry.message, entry.data || '');
        break;
      case LogLevel.ERROR:
        this.safeConsole.error(`${prefix} ❌`, entry.message, entry.data || '');
        break;
    }
  }
}

// Future: Add Sentry provider
// class SentryLoggerProvider implements LoggerProvider { ... }

class MainAppLogger implements AppLogger {
  private providers: LoggerProvider[] = [];

  constructor() {
    this.providers.push(new ConsoleLoggerProvider());
  }

  addProvider(provider: LoggerProvider): void {
    this.providers.push(provider);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      process: 'main'
    };

    this.providers.forEach(provider => provider.log(entry));
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }
}

// Export the main logger instance
export const mainLogger = new MainAppLogger();