import { expect, test } from 'vitest'
import type { PdfSidecar, UnifiedAnnotation } from '../../../../electron/shared/schema'
import { addPdfAnnotation, annotationsForPage, removePdfAnnotation, updatePdfAnnotation } from './pdf-annotation-sidecar'

const annotation: UnifiedAnnotation = { id: 'highlight-1', type: 'highlight', loc: { page: 2, epubCfi: null }, quote: '重点', rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.04 }], color: '#fff1a8', createdAt: 1, updatedAt: 1 }
const sidecar: PdfSidecar = { version: 1, path: 'D:\book.pdf', kind: 'pdf', book: { progress: { page: 1, epubCfi: null, scrollTop: 0, percent: 0, zoom: 100, layout: 'continuous', updatedAt: 1 } }, annotations: [], bookmarks: [], epubSettings: null, tts: null }

test('adds, updates, groups and removes PDF sidecar annotations without mutating the source', () => {
  const added = addPdfAnnotation(sidecar, annotation)
  const updated = updatePdfAnnotation(added, annotation.id, { color: '#1677ff', updatedAt: 2 })

  expect(sidecar.annotations).toEqual([])
  expect(annotationsForPage(updated, 2)).toMatchObject([{ id: 'highlight-1', color: '#1677ff' }])
  expect(removePdfAnnotation(updated, annotation.id).annotations).toEqual([])
})
