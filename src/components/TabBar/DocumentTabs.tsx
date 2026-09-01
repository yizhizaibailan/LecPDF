/**
 * 渲染开始页与已打开文档的无状态标签栏。
 * 组件仅向上派发激活和关闭意图，不保存标签选择状态，确保 Store 仍是唯一状态来源。
 */
import type { ReaderTab } from '../../types/document'

/** 表示文档标签栏由上层提供的渲染数据和操作意图。 */
export type DocumentTabsProps = {
  tabs: ReaderTab[]
  activeTabId: string
  onActivate(tabId: string): void
  onClose(tabId: string): void
}

/**
 * 导出文档标签栏，开始页不显示关闭按钮，文档标签则保留独立的可访问关闭操作。
 * 点击事件同步派发；异步文档释放由上层 Store 的关闭动作负责，组件不等待或管理它。
 */
export function DocumentTabs({ tabs, activeTabId, onActivate, onClose }: DocumentTabsProps): JSX.Element {
  return (
    <nav className="document-tabs" aria-label="文档标签">
      <div className="document-tabs__list" role="tablist">
        {tabs.map((tab) => (
          <div key={tab.id} className={`document-tabs__item${tab.id === activeTabId ? ' document-tabs__item--active' : ''}`}>
            <button
              type="button"
              className="document-tabs__activate"
              role="tab"
              aria-selected={tab.id === activeTabId}
              onClick={() => onActivate(tab.id)}
            >
              {tab.title}
            </button>
            {tab.closable && (
              <button
                type="button"
                className="document-tabs__close"
                aria-label={`关闭 ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(tab.id)
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}
