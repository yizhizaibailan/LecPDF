import type { NormalizedPoint, NormalizedRect, UnifiedAnnotation } from '../../../../electron/shared/schema'

export type PdfPageSpace = { width: number; height: number; rotation: 0 | 90 | 180 | 270 }
export type PdfPoint = { x: number; y: number }
export type PdfTransfer = { id: string; pageIndex: number; type: number; rect: { origin: PdfPoint; size: { width: number; height: number } }; contents?: string; strokeColor: string; segmentRects?: Array<{ origin: PdfPoint; size: { width: number; height: number } }>; inkList?: Array<{ points: PdfPoint[] }> }

export function normalizedToPdfPoint(point: NormalizedPoint, page: PdfPageSpace): PdfPoint {
  const x = point.x * page.width; const y = point.y * page.height
  if (page.rotation === 90) return { x: page.height - y, y: x }
  if (page.rotation === 180) return { x: page.width - x, y: page.height - y }
  if (page.rotation === 270) return { x: y, y: page.width - x }
  return { x, y }
}

function rect(rectangle: NormalizedRect, page: PdfPageSpace) {
  const origin = normalizedToPdfPoint(rectangle, page)
  const end = normalizedToPdfPoint({ x: rectangle.x + rectangle.w, y: rectangle.y + rectangle.h }, page)
  return { origin: { x: Math.min(origin.x, end.x), y: Math.min(origin.y, end.y) }, size: { width: Math.abs(end.x - origin.x), height: Math.abs(end.y - origin.y) } }
}

export function annotationToPdfTransfer(annotation: UnifiedAnnotation, page: PdfPageSpace): PdfTransfer {
  if (annotation.loc.page === null) throw new Error('PDF 批注缺少页码')
  const base = { id: annotation.id, pageIndex: annotation.loc.page, strokeColor: annotation.color }
  if (annotation.type === 'note') return { ...base, type: 1, rect: { origin: normalizedToPdfPoint(annotation.point, page), size: { width: 18, height: 18 } }, contents: annotation.body }
  if (annotation.type === 'freetext') return { ...base, type: 3, rect: rect(annotation.rect, page), contents: annotation.body }
  if (annotation.type === 'ink') { const inkList = annotation.ink.map((path) => ({ points: path.map((point) => normalizedToPdfPoint(point, page)) })); return { ...base, type: 15, rect: { origin: inkList[0]?.points[0] ?? { x: 0, y: 0 }, size: { width: 0, height: 0 } }, inkList } }
  const types = { highlight: 9, underline: 10, strikeout: 12, squiggly: 11 } as const
  const segmentRects = annotation.rects.map((item) => rect(item, page))
  return { ...base, type: types[annotation.type], rect: segmentRects[0], contents: annotation.quote, segmentRects }
}
