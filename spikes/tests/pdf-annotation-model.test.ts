import { describe, expect, it } from 'vitest';
import { normalizedToPage, pageToNormalized } from '../labs/pdf-annotations-print/coordinates';
import { assertPdfAnnotationRecord, type PdfAnnotationRecord } from '../labs/pdf-annotations-print/model';

describe('PDF coordinate transforms', () => {
  it.each([0, 90, 180, 270] as const)('round-trips a quad at %i degrees', (rotation) => {
    const page = { width: 612, height: 792, rotation };
    const quad = [72, 700, 240, 700, 72, 680, 240, 680];
    const restored = normalizedToPage(pageToNormalized(quad, page), page);
    restored.forEach((value, index) => expect(value).toBeCloseTo(quad[index], 8));
  });

  it.each([
    { rotation: 0 as const, displayed: [61.2, 79.2] },
    { rotation: 90 as const, displayed: [712.8, 61.2] },
    { rotation: 180 as const, displayed: [550.8, 712.8] },
    { rotation: 270 as const, displayed: [79.2, 550.8] },
  ])('undoes $rotation degree rotation before normalization', ({ rotation, displayed }) => {
    expect(pageToNormalized(displayed, { width: 612, height: 792, rotation })).toEqual([
      expect.closeTo(0.1, 10),
      expect.closeTo(0.1, 10),
    ]);
  });

  it.each([
    { coordinates: [1], page: { width: 612, height: 792, rotation: 0 } },
    { coordinates: [Number.NaN, 1], page: { width: 612, height: 792, rotation: 0 } },
    { coordinates: [1, 1], page: { width: 0, height: 792, rotation: 0 } },
    { coordinates: [1, 1], page: { width: 612, height: 792, rotation: 45 } },
  ])('rejects invalid coordinate input %#', ({ coordinates, page }) => {
    expect(() => pageToNormalized(coordinates, page as never)).toThrow();
  });
});

describe('PDF annotation record validation', () => {
  const base = {
    id: 'annotation-1',
    pageIndex: 0,
    color: '#ffd54f',
    opacity: 0.75,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
  };
  const records: PdfAnnotationRecord[] = [
    { ...base, id: 'highlight', type: 'highlight', quads: [[0.1, 0.2, 0.4, 0.2, 0.1, 0.18, 0.4, 0.18]], quote: 'alpha' },
    { ...base, id: 'underline', type: 'underline', quads: [[0.1, 0.2, 0.4, 0.2, 0.1, 0.18, 0.4, 0.18]], quote: 'beta' },
    { ...base, id: 'strikeout', type: 'strikeout', quads: [[0.1, 0.2, 0.4, 0.2, 0.1, 0.18, 0.4, 0.18]], quote: 'gamma' },
    { ...base, id: 'squiggly', type: 'squiggly', quads: [[0.1, 0.2, 0.4, 0.2, 0.1, 0.18, 0.4, 0.18]], quote: 'delta' },
    { ...base, id: 'note', type: 'note', point: { x: 0.5, y: 0.5 }, body: 'note' },
    { ...base, id: 'freeText', type: 'freeText', rect: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 }, body: 'free text', fontSize: 12 },
    { ...base, id: 'ink', type: 'ink', paths: [[{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]], strokeWidth: 2 },
  ];

  it('accepts all seven LecPDF annotation types', () => {
    for (const record of records) expect(() => assertPdfAnnotationRecord(record)).not.toThrow();
  });

  it.each([
    { ...records[0], type: 'stamp' },
    { ...records[0], pageIndex: -1 },
    { ...records[0], opacity: 2 },
    { ...records[0], color: 'yellow' },
    { ...records[0], updatedAt: 'yesterday' },
    { ...records[0], quads: [] },
    { ...records[4], point: { x: Number.NaN, y: 0.5 } },
    { ...records[5], rect: { x: 0.1, y: 0.1, width: 0, height: 0.1 } },
    { ...records[6], paths: [[]] },
  ])('rejects malformed record %#', (record) => {
    expect(() => assertPdfAnnotationRecord(record)).toThrow('invalid PdfAnnotationRecord');
  });
});
