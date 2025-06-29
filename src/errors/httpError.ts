/**
 * Represents an HTTP error with a status code and message.
 *
 * @property {number} code - The HTTP status code associated with the error.
 */
export class HttpError extends Error {
  code: number;
  method: string;
  url: string;

  /**
   * Creates a new HttpError instance.
   *
   * @param {string} message - The error message.
   * @param {number} code - The HTTP status code.
   */
  constructor(message: string, code: number, method?: string, url?: string) {
    super(message);
    this.code = code;
    this.method = method ?? '';
    this.url = url ?? '';
  }
}
