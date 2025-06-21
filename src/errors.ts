/**
 * Custom error class used for HTTP error handling.
 * Includes the HTTP status code for more detailed error reporting.
 */
export class HttpError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}
