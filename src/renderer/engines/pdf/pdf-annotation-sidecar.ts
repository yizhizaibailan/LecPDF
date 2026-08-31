import type { PdfSidecar, UnifiedAnnotation } from '../../../../electron/shared/schema'

/** Sidecar-only PDF annotation mutations. Source PDFs are never modified here. */
export function addPdfAnnotation(sidecar: PdfSidecar, annotation: UnifiedAnnotation): PdfSidecar {
  if (annotation.loc.page === null) throw new Error('PDF 批注必须定位到页码')
  if (sidecar.annotations.some(({ id }) => id === annotation.id)) throw new Error(`批注已存在：${annotation.id}`)
  return { ...sidecar, annotations: [...sidecar.annotations, annotation] }
}

export function updatePdfAnnotation(sidecar: PdfSidecar, id: string, patch: Partial<UnifiedAnnotation>): PdfSidecar {
  let found = false
  const annotations = sidecar.annotations.map((annotation) => {
    if (annotation.id !== id) return annotation
    found = true
    return { ...annotation, ...patch, id: annotation.id, loc: annotation.loc, type: annotation.type } as UnifiedAnnotation
  })
  if (!found) throw new Error(`找不到批注：${id}`)
  return { ...sidecar, annotations }
}

export function removePdfAnnotation(sidecar: PdfSidecar, id: string): PdfSidecar {
  return { ...sidecar, annotations: sidecar.annotations.filter((annotation) => annotation.id !== id) }
}

export function annotationsForPage(sidecar: PdfSidecar, page: number): UnifiedAnnotation[] {
  return sidecar.annotations.filter((annotation) => annotation.loc.page === page)
}
