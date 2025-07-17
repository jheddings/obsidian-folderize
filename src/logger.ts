export enum LogLevel {
    DEBUG = 30,
    INFO = 20,
    WARN = 10,
    ERROR = 0,
}

class LoggerInstance {
    private name: string;
    private logLevel: LogLevel;

    constructor(name: string, logLevel: LogLevel = LogLevel.ERROR) {
        this.name = name;
        this.logLevel = logLevel;
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        return level <= this.logLevel;
    }

    log(message: string, ...args: any[]): void {
        console.log(`[Folderize:${this.name}] ${message}`, ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.log(message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log(message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log(message, ...args);
    }

    error(message: string, ...args: any[]): void {
        this.log(message, ...args);
    }
}

export class Logger {
    private static loggers: Map<string, LoggerInstance> = new Map();
    private static globalLogLevel: LogLevel = LogLevel.ERROR;

    static getLogger(name: string): LoggerInstance {
        if (!Logger.loggers.has(name)) {
            Logger.loggers.set(name, new LoggerInstance(name, Logger.globalLogLevel));
        }
        return Logger.loggers.get(name)!;
    }

    static setGlobalLogLevel(level: LogLevel): void {
        Logger.globalLogLevel = level;

        for (const logger of Logger.loggers.values()) {
            logger.setLogLevel(level);
        }
    }

    static getGlobalLogLevel(): LogLevel {
        return Logger.globalLogLevel;
    }
}
