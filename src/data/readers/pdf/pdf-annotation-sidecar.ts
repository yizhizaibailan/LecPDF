/**
 * 提供 PDF sidecar 的纯数据增删改查询，不直接修改源 PDF 文件。
 * 这些函数保持不可变返回值，供后续 Store 或持久化编排层安全复用。
 */
import type { PdfSidecar, UnifiedAnnotation } from '../../../../electron/shared/schema'

/** 向 sidecar 添加一条已定位到页码的批注，并拒绝重复标识。 */
export function addPdfAnnotation(sidecar: PdfSidecar, annotation: UnifiedAnnotation): PdfSidecar {
  if (annotation.loc.page === null) throw new Error('PDF 批注必须定位到页码')
  if (sidecar.annotations.some(({ id }) => id === annotation.id)) throw new Error(`批注已存在：${annotation.id}`)
  return { ...sidecar, annotations: [...sidecar.annotations, annotation] }
}

/** 只更新可变字段，保持批注标识、位置与类型不可被补丁篡改。 */
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

/** 从 sidecar 返回移除指定批注后的不可变副本。 */
export function removePdfAnnotation(sidecar: PdfSidecar, id: string): PdfSidecar {
  return { ...sidecar, annotations: sidecar.annotations.filter((annotation) => annotation.id !== id) }
}

/** 查询某一页的批注，供阅读视图按页加载。 */
export function annotationsForPage(sidecar: PdfSidecar, page: number): UnifiedAnnotation[] {
  return sidecar.annotations.filter((annotation) => annotation.loc.page === page)
}
