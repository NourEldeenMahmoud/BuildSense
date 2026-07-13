import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  pretty?: boolean;
}

export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const { level = 'info', name = 'buildsense', pretty = false } = options;

  const config: pino.LoggerOptions = {
    level,
    name,
  };

  if (pretty) {
    config.transport = {
      target: 'pino-pretty',
      options: { colorize: true },
    };
  }

  return pino(config);
}
