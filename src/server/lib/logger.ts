import { config } from "../config";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  [key: string]: any;
}

class Logger {
  private defaultContext: Record<string, any>;

  constructor(defaultContext: Record<string, any> = {}) {
    this.defaultContext = defaultContext;
  }

  private shouldLog(level: LogLevel): boolean {
    if (level === "debug") {
      return Boolean(process.env.DEBUG || !config.isProd);
    }
    return true;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    err?: unknown
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.defaultContext,
      ...(context || {}),
    };

    if (err) {
      if (err instanceof Error) {
        entry.error = {
          name: err.name,
          message: err.message,
          stack: err.stack,
        };
      } else {
        entry.error = {
          message: String(err),
        };
      }
    }

    if (config.isProd) {
      return JSON.stringify(entry);
    }

    // Dev / Test mode: format yang mudah dibaca secara visual di terminal
    const mod = entry.module ? `[${entry.module}] ` : "";
    const extra = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
    const errStr = entry.error?.stack
      ? `\n${entry.error.stack}`
      : entry.error
        ? ` (${entry.error.message})`
        : "";
    return `[${entry.timestamp.slice(11, 19)}] [${level.toUpperCase()}] ${mod}${message}${extra}${errStr}`;
  }

  debug(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog("debug")) return;
    console.debug(this.formatMessage("debug", message, context));
  }

  info(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog("info")) return;
    console.log(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog("warn")) return;
    console.warn(this.formatMessage("warn", message, context));
  }

  error(
    message: string,
    errorOrContext?: Error | Record<string, any> | unknown,
    context?: Record<string, any>
  ): void {
    let err: unknown = undefined;
    let ctx = context;

    if (errorOrContext instanceof Error) {
      err = errorOrContext;
    } else if (
      typeof errorOrContext === "object" &&
      errorOrContext !== null &&
      !(errorOrContext instanceof Error)
    ) {
      ctx = { ...(errorOrContext as Record<string, any>), ...(context || {}) };
    } else if (errorOrContext !== undefined) {
      err = errorOrContext;
    }

    console.error(this.formatMessage("error", message, ctx, err));
  }

  child(context: Record<string, any>): Logger {
    return new Logger({ ...this.defaultContext, ...context });
  }
}

export const logger = new Logger();
