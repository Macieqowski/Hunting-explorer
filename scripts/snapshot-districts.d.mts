// Types for the parts of snapshot-districts.mjs that the tests use.
export const FORMAT: number;
export const FIELDS: string[];
export const MIN_COUNT: number;
export function encodeSnapshot(
  districts: Record<string, unknown>[],
  date: string,
): {
  format: number;
  version: string;
  date: string;
  count: number;
  source: string;
  fields: string[];
  text: number[];
  strings: string[];
  rows: (number | null)[][];
};
export function metaOf(snapshot: { format: number; version: string; date: string; count: number }): {
  format: number;
  version: string;
  date: string;
  count: number;
};
export function isValidSnapshot(s: unknown): boolean;
