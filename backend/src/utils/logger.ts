import * as Sentry from '@sentry/node';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const levelMap: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

export class Logger {
  private static instance: Logger;
  private level: LogLevel;

  private constructor(level: string = 'info') {
    this.level = levelMap[level.toLowerCase()] || LogLevel.INFO;
  }

  static getInstance(level?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(level);
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const meta = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${meta}`;
  }

  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.level <= LogLevel.ERROR) {
      const errorData = error instanceof Error ? error.message : error;
      console.error(this.formatMessage('ERROR', message, errorData));

      // Capture Sentry Exceptions
      if (error instanceof Error) {
        Sentry.captureException(error, { extra: { contextMessage: message } });
      } else if (error) {
        Sentry.captureMessage(`${message}: ${typeof error === 'object' ? JSON.stringify(error) : error}`, 'error');
      } else {
        Sentry.captureMessage(message, 'error');
      }
    }
  }
}

export default Logger.getInstance();
