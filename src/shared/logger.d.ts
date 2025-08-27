/**
 * Modular logging utility for Electron app (main + renderer processes)
 *
 * Uses import.meta.env.MODE to determine environment
 * Designed to be easily extensible with external logging services (Sentry, etc.)
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export interface LogEntry {
    level: LogLevel;
    message: string;
    data?: any;
    timestamp: Date;
    process: 'main' | 'renderer';
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
export declare const createLogger: (processType: "main" | "renderer") => Logger;
export declare const rendererLogger: Logger;
export declare const mainLogger: Logger;
//# sourceMappingURL=logger.d.ts.map