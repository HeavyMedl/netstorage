/**
 * Error thrown when a required configuration value is missing or invalid.
 */
export class ConfigValidationError extends TypeError {
  field: string;

  constructor(field: string) {
    super(`Missing or invalid \`${field}\` in configuration`);
    this.name = 'ConfigValidationError';
    this.field = field;
  }
}
