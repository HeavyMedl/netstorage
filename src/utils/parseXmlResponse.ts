import { XMLParser } from 'fast-xml-parser';

/**
 * Represents the parsed object structure of a NetStorage XML API response.
 *
 * After parsing XML responses from Akamai NetStorage using `fast-xml-parser`,
 * this type reflects the normalized JavaScript object shape.
 *
 * Each top-level key corresponds to the original XML tag (e.g., `stat`, `du`, `dir`, `upload`, etc.),
 * and the associated value contains its parsed attributes or children.
 *
 * Example:
 * ```ts
 * {
 *   stat: { code: "200", message: "OK" },
 *   du: { directory: "foo/bar", size: "12345" }
 * }
 * ```
 */
export type ParsedNetStorageResponse = Record<string, Record<string, unknown>>;

/**
 * Parses an XML response from the NetStorage API into a JavaScript object.
 *
 * @param body - The XML response body.
 * @param status - The HTTP status code.
 * @returns A parsed NetStorage response object.
 */
export function parseXmlResponse<T = ParsedNetStorageResponse>(
  body: string,
  status: number,
): T {
  if (!body.trimStart().startsWith('<?xml')) {
    return { status: { code: status } } as T;
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  return parser.parse(body) as T;
}
