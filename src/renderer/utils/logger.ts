/**
 * Renderer process logging utility
 *
 * Uses import.meta.env.MODE to determine environment
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
  data?: any;
  timestamp: Date;
  process: 'renderer';
}

export interface Logger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

export interface LoggerProvider {
  log: (entry: LogEntry) => void;
  shouldLog: (level: LogLevel) => boolean;
}

class ConsoleLoggerProvider implements LoggerProvider {
  private minLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.MODE === 'development';
    this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {return;}

    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [renderer]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix} 🐛`, entry.message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(`${prefix} ℹ️`, entry.message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ⚠️`, entry.message, entry.data || '');
        break;
      case LogLevel.ERROR:
        console.error(`${prefix} ❌`, entry.message, entry.data || '');
        break;
    }
  }
}

// Future: Add Sentry provider
// class SentryLoggerProvider implements LoggerProvider { ... }

class RendererLogger implements Logger {
  private providers: LoggerProvider[] = [];

  constructor() {
    this.providers.push(new ConsoleLoggerProvider());
  }

  addProvider(provider: LoggerProvider): void {
    this.providers.push(provider);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      process: 'renderer'
    };

    this.providers.forEach(provider => provider.log(entry));
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
}

// Export the renderer logger instance
export const rendererLogger = new RendererLogger();