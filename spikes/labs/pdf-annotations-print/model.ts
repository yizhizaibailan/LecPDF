type Base = {
  id: string;
  pageIndex: number;
  color: string;
  opacity: number;
  createdAt: string;
  updatedAt: string;
};

export type TextMarkupType = 'highlight' | 'underline' | 'strikeout' | 'squiggly';

export type PdfAnnotationRecord =
  | (Base & { type: TextMarkupType; quads: number[][]; quote: string })
  | (Base & { type: 'note'; point: { x: number; y: number }; body: string })
  | (Base & { type: 'freeText'; rect: { x: number; y: number; width: number; height: number }; body: string; fontSize: number })
  | (Base & { type: 'ink'; paths: Array<Array<{ x: number; y: number }>>; strokeWidth: number });

const TEXT_MARKUP_TYPES = new Set<TextMarkupType>(['highlight', 'underline', 'strikeout', 'squiggly']);
const COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  if (!isString(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isNormalizedNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return isObject(value) && isNormalizedNumber(value.x) && isNormalizedNumber(value.y);
}

function hasValidBase(record: Record<string, unknown>): boolean {
  return isNonEmptyString(record.id)
    && Number.isInteger(record.pageIndex)
    && (record.pageIndex as number) >= 0
    && isString(record.color)
    && COLOR.test(record.color)
    && typeof record.opacity === 'number'
    && Number.isFinite(record.opacity)
    && record.opacity >= 0
    && record.opacity <= 1
    && isIsoDate(record.createdAt)
    && isIsoDate(record.updatedAt);
}

export function assertPdfAnnotationRecord(value: unknown): asserts value is PdfAnnotationRecord {
  if (!isObject(value) || !hasValidBase(value) || !isString(value.type)) {
    throw new Error('invalid PdfAnnotationRecord');
  }

  if (TEXT_MARKUP_TYPES.has(value.type as TextMarkupType)) {
    const validQuads = Array.isArray(value.quads)
      && value.quads.length > 0
      && value.quads.every((quad) => Array.isArray(quad) && quad.length === 8 && quad.every(isNormalizedNumber));
    if (validQuads && isString(value.quote)) return;
  } else if (value.type === 'note') {
    if (isPoint(value.point) && isString(value.body)) return;
  } else if (value.type === 'freeText') {
    if (
      isObject(value.rect)
      && isNormalizedNumber(value.rect.x)
      && isNormalizedNumber(value.rect.y)
      && typeof value.rect.width === 'number'
      && Number.isFinite(value.rect.width)
      && value.rect.width > 0
      && value.rect.width <= 1
      && typeof value.rect.height === 'number'
      && Number.isFinite(value.rect.height)
      && value.rect.height > 0
      && value.rect.height <= 1
      && isString(value.body)
      && typeof value.fontSize === 'number'
      && Number.isFinite(value.fontSize)
      && value.fontSize > 0
    ) return;
  } else if (value.type === 'ink') {
    const validPaths = Array.isArray(value.paths)
      && value.paths.length > 0
      && value.paths.every((path) => Array.isArray(path) && path.length >= 2 && path.every(isPoint));
    if (
      validPaths
      && typeof value.strokeWidth === 'number'
      && Number.isFinite(value.strokeWidth)
      && value.strokeWidth > 0
    ) return;
  }

  throw new Error('invalid PdfAnnotationRecord');
}

export function assertPdfAnnotationRecords(value: unknown): asserts value is PdfAnnotationRecord[] {
  if (!Array.isArray(value)) throw new Error('invalid PdfAnnotationRecord array');
  value.forEach(assertPdfAnnotationRecord);
}
