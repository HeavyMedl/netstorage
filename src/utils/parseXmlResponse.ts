import { XMLParser } from 'fast-xml-parser';

/**
 * Represents the parsed structure of a NetStorage XML API response.
 */
export type ParsedNetStorageResponse = Record<string, Record<string, unknown>>;

/**
 * Parses a NetStorage XML response string into a structured JavaScript object.
 *
 * @param body - The XML string returned by the NetStorage API.
 * @param status - The HTTP status code from the response.
 * @returns A parsed object representing the XML response.
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
