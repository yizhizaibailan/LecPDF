import { expect, test } from 'vitest'
import type { UnifiedAnnotation } from '../../../../electron/shared/schema'
import { annotationToPdfTransfer, normalizedToPdfPoint } from './pdf-annotation-transfer'

test.each([0, 90, 180, 270] as const)('restores normalized points for %i degree PDF pages', (rotation) => {
  const point = normalizedToPdfPoint({ x: 0.25, y: 0.75 }, { width: 612, height: 792, rotation })
  expect(point.x).toBeGreaterThanOrEqual(0)
  expect(point.y).toBeGreaterThanOrEqual(0)
})

test('maps all seven sidecar annotation types to PDF transfer objects', () => {
  const base = { loc: { page: 0, epubCfi: null } as const, quote: 'x', color: '#1677ff', createdAt: 1, updatedAt: 1 }
  const annotations: UnifiedAnnotation[] = [
    { ...base, id: 'h', type: 'highlight', rects: [{ x: 0.1, y: 0.2, w: 0.2, h: 0.04 }] },
    { ...base, id: 'u', type: 'underline', rects: [{ x: 0.1, y: 0.2, w: 0.2, h: 0.04 }] },
    { ...base, id: 's', type: 'strikeout', rects: [{ x: 0.1, y: 0.2, w: 0.2, h: 0.04 }] },
    { ...base, id: 'q', type: 'squiggly', rects: [{ x: 0.1, y: 0.2, w: 0.2, h: 0.04 }] },
    { ...base, id: 'n', type: 'note', point: { x: 0.2, y: 0.2 }, body: 'note' },
    { ...base, id: 'f', type: 'freetext', rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.1 }, body: 'text' },
    { ...base, id: 'i', type: 'ink', ink: [[{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]] }
  ]
  expect(annotations.map((annotation) => annotationToPdfTransfer(annotation, { width: 612, height: 792, rotation: 0 }).type)).toEqual([9, 10, 12, 11, 1, 3, 15])
})
