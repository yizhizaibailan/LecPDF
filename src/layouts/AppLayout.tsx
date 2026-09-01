import { BorderOutlined, CloseOutlined, MinusOutlined, ShrinkOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ZH_CN } from '../locales/zh-CN'

/**
 * 渲染无边框窗口的自定义标题栏。
 * 通过受限的 window.lec.window API 请求窗口操作，并订阅最大化状态来同步图标，而不直接调用 Electron 对象。
 */
export function WindowTitlebar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => window.lec.window.onMaximizedChange(setMaximized), [])

  return (
    <header
      className="window-titlebar"
      data-window-drag-region="true"
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('button') === null) {
          void window.lec.window.toggleMaximize()
        }
      }}
    >
      <span className="window-titlebar__name">{ZH_CN.appName}</span>
      <div className="window-titlebar__controls" aria-label="窗口控制">
        <button type="button" aria-label={ZH_CN.window.minimize} onClick={() => void window.lec.window.minimize()}>
          <MinusOutlined />
        </button>
        <button
          type="button"
          aria-label={ZH_CN.window.toggleMaximize}
          title={maximized ? '还原窗口' : '最大化窗口'}
          onClick={() => void window.lec.window.toggleMaximize()}
        >
          {maximized ? <ShrinkOutlined /> : <BorderOutlined />}
        </button>
        <button type="button" aria-label={ZH_CN.window.close} className="window-titlebar__close" onClick={() => void window.lec.window.close()}>
          <CloseOutlined />
        </button>
      </div>
    </header>
  )
}

/**
 * 提供所有页面共用的窗口外壳；页面把自己的标签插槽和 main 内容传入，从而避免重复标题栏实现。
 */
export function AppLayout({ children, tabs }: { children: ReactNode; tabs?: ReactNode }): JSX.Element {
  return (
    <div className="app-frame">
      <WindowTitlebar />
      {tabs === undefined ? null : <div className="app-frame__tabs">{tabs}</div>}
      {children}
    </div>
  )
}
