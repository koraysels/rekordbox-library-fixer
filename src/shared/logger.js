"use strict";
/**
 * Modular logging utility for Electron app (main + renderer processes)
 *
 * Uses import.meta.env.MODE to determine environment
 * Designed to be easily extensible with external logging services (Sentry, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainLogger = exports.rendererLogger = exports.createLogger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class ConsoleLoggerProvider {
    constructor(processType) {
        // Safe console logging for main process to prevent EPIPE errors
        this.safeConsole = {
            debug: (...args) => {
                try {
                    console.debug(...args);
                }
                catch (error) {
                    // Silently ignore EPIPE errors during logging
                }
            },
            info: (...args) => {
                try {
                    console.info(...args);
                }
                catch (error) {
                    // Silently ignore EPIPE errors during logging
                }
            },
            warn: (...args) => {
                try {
                    console.warn(...args);
                }
                catch (error) {
                    // Silently ignore EPIPE errors during logging
                }
            },
            error: (...args) => {
                try {
                    console.error(...args);
                }
                catch (error) {
                    // Silently ignore EPIPE errors during logging
                }
            }
        };
        // Use import.meta.env.MODE as recommended for Vite + Electron
        this.isDevelopment = import.meta.env.MODE === 'development';
        this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
        this.isMainProcess = processType === 'main';
    }
    shouldLog(level) {
        return level >= this.minLevel;
    }
    log(entry) {
        if (!this.shouldLog(entry.level))
            return;
        const timestamp = entry.timestamp.toISOString();
        const process = entry.process;
        const prefix = `[${timestamp}] [${process}]`;
        // Use safe console for main process, regular console for renderer
        const consoleInstance = this.isMainProcess ? this.safeConsole : console;
        switch (entry.level) {
            case LogLevel.DEBUG:
                consoleInstance.debug(`${prefix} 🐛`, entry.message, entry.data || '');
                break;
            case LogLevel.INFO:
                consoleInstance.info(`${prefix} ℹ️`, entry.message, entry.data || '');
                break;
            case LogLevel.WARN:
                consoleInstance.warn(`${prefix} ⚠️`, entry.message, entry.data || '');
                break;
            case LogLevel.ERROR:
                consoleInstance.error(`${prefix} ❌`, entry.message, entry.data || '');
                break;
        }
    }
}
// Future: Add Sentry provider
// class SentryLoggerProvider implements LoggerProvider { ... }
class AppLogger {
    constructor(processType) {
        this.providers = [];
        this.processType = processType;
        this.providers.push(new ConsoleLoggerProvider(processType));
    }
    addProvider(provider) {
        this.providers.push(provider);
    }
    log(level, message, data) {
        const entry = {
            level,
            message,
            data,
            timestamp: new Date(),
            process: this.processType
        };
        this.providers.forEach(provider => provider.log(entry));
    }
    debug(message, data) {
        this.log(LogLevel.DEBUG, message, data);
    }
    info(message, data) {
        this.log(LogLevel.INFO, message, data);
    }
    warn(message, data) {
        this.log(LogLevel.WARN, message, data);
    }
    error(message, data) {
        this.log(LogLevel.ERROR, message, data);
    }
}
// Export logger instances for different processes
const createLogger = (processType) => {
    return new AppLogger(processType);
};
exports.createLogger = createLogger;
// Convenience exports for common use
exports.rendererLogger = (0, exports.createLogger)('renderer');
exports.mainLogger = (0, exports.createLogger)('main');
//# sourceMappingURL=logger.js.map