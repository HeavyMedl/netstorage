import winston from 'winston';
import type { WinstonLogLevel } from '../types';

winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray',
});

/**
 * Creates a scoped Winston logger with a standardized format.
 *
 * @param level - The minimum log level to output (e.g., 'info', 'debug').
 * @param scope - Optional identifier for the module or class using the logger.
 * @returns A configured Winston Logger instance.
 */
export function createLogger(level: WinstonLogLevel = 'info', scope = '') {
  const colorizer = winston.format.colorize();

  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.label({
        label: scope,
      }),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf((info) => {
        const { timestamp, level, message, label, method } = info;
        const rawLevel = level.toUpperCase();
        const coloredLevel = colorizer.colorize(level, rawLevel);

        const coloredMethod = method
          ? colorizer.colorize('info', `[${method}]`)
          : '';

        return `[${coloredLevel}] ${timestamp} [${label}]: ${coloredMethod} ${message}`;
      }),
    ),
    transports: [new winston.transports.Console()],
  });
}
