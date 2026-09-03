/**
 * 渲染与阅读内核无关的 PDF 目录树。
 * 组件只接收标准化目录、当前页与跳转意图，目录解析和页码定位由 PDF 数据层负责。
 */
import type { PdfOutlineItem } from '../../data/readers/pdf/pdf-navigation-controller'

/** 渲染目录树，并以当前页高亮最后一个已到达的目录项。 */
export function PdfOutlineView({ items, currentPage, onJump }: { items: PdfOutlineItem[]; currentPage: number; onJump(pageNumber: number): void }): JSX.Element {
  return <ul className="reader-outline__list">{items.map((item, index) => <li key={`${item.title}-${index}`}><button type="button" className="reader-outline__item" disabled={item.pageNumber === null} aria-current={item.pageNumber === currentPage ? 'page' : undefined} onClick={() => { if (item.pageNumber !== null) onJump(item.pageNumber) }}>{item.title}</button>{item.children.length > 0 && <PdfOutlineView items={item.children} currentPage={currentPage} onJump={onJump} />}</li>)}</ul>
}
