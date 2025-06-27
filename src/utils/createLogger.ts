import winston from 'winston';

/**
 * Winston logging levels using the `npm` levels preset.
 *
 * These represent log severity levels in ascending order of verbosity.
 *
 * @property {'error'} error - Critical errors that require immediate attention.
 * @property {'warn'} warn - Warnings that might indicate potential issues.
 * @property {'info'} info - General informational messages.
 * @property {'http'} http - HTTP-level logs, useful for request tracing.
 * @property {'verbose'} verbose - More detailed information for debugging.
 * @property {'debug'} debug - Debug-level logs with internal state details.
 * @property {'silly'} silly - Highly verbose logs, usually not needed in production.
 *
 * @see https://github.com/winstonjs/winston#logging-levels
 */
export type WinstonLogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'silly';

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
 * Create a scoped Winston logger with colorized output.
 *
 * @param level - Minimum log level to emit. Defaults to 'info'.
 * @param scope - Optional string label for the logger (e.g. module name).
 * @returns Configured Winston logger instance.
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
