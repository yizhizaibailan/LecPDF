/**
 * 渲染与阅读内核无关的 PDF 目录树。
 * 组件只接收标准化目录、当前页与跳转意图，目录解析和页码定位由 PDF 数据层负责。
 */
import type { PdfOutlineItem } from '../../data/readers/pdf/pdf-navigation-controller'

/** 计算阅读页之前最后一个可跳转目录的路径，以保持章节级高亮。 */
function findActivePath(items: PdfOutlineItem[], currentPage: number, parentPath = ''): string | null {
  let activePath: string | null = null
  for (const [index, item] of items.entries()) {
    const path = `${parentPath}${index}`
    if (item.pageNumber !== null && item.pageNumber <= currentPage) activePath = path
    activePath = findActivePath(item.children, currentPage, `${path}.`) ?? activePath
  }
  return activePath
}

/** 以递归方式渲染目录层级，并只给当前章节添加无障碍状态。 */
function OutlineTree({ items, currentPage, activePath, parentPath, depth, onJump }: { items: PdfOutlineItem[]; currentPage: number; activePath: string | null; parentPath: string; depth: number; onJump(pageNumber: number): void }): JSX.Element {
  return <ul className="reader-outline__list">{items.map((item, index) => {
    const path = `${parentPath}${index}`
    const active = activePath === path
    return <li key={path}><button type="button" className={`reader-outline__item${active ? ' reader-outline__item--active' : ''}`} style={{ paddingLeft: `${12 + depth * 16}px` }} disabled={item.pageNumber === null} aria-current={active ? 'page' : undefined} onClick={() => { if (item.pageNumber !== null) onJump(item.pageNumber) }}>{item.title}</button>{item.children.length > 0 && <OutlineTree items={item.children} currentPage={currentPage} activePath={activePath} parentPath={`${path}.`} depth={depth + 1} onJump={onJump} />}</li>
  })}</ul>
}

/** 渲染目录树，并以当前页高亮最后一个已到达的目录项。 */
export function PdfOutlineView({ items, currentPage, onJump }: { items: PdfOutlineItem[]; currentPage: number; onJump(pageNumber: number): void }): JSX.Element {
  return <OutlineTree items={items} currentPage={currentPage} activePath={findActivePath(items, currentPage)} parentPath="" depth={0} onJump={onJump} />
}
