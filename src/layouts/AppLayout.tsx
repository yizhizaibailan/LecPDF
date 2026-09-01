import { BorderOutlined, CloseOutlined, MinusOutlined, ShrinkOutlined } from '@ant-design/icons'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { LecApi } from '../../electron/shared/ipc'
import { ZH_CN } from '../locales/zh-CN'

/** 保存渲染入口注入的窗口控制白名单，布局层不直接读取全局 preload 桥接对象。 */
const WindowControlsContext = createContext<LecApi['window'] | null>(null)

/**
 * 向应用布局提供受限窗口能力，确保渲染入口是唯一读取全局 preload 桥接对象的位置。
 * 资源说明：Provider 不订阅窗口事件；标题栏组件负责在卸载时归还最大化状态订阅。
 */
export function WindowControlsProvider({ children, windowControls }: { children: ReactNode; windowControls: LecApi['window'] }): JSX.Element {
  return <WindowControlsContext.Provider value={windowControls}>{children}</WindowControlsContext.Provider>
}

/** 读取已注入的窗口能力；缺失 Provider 时直接失败以防布局绕开入口的受限依赖。 */
function useWindowControls(): LecApi['window'] {
  const windowControls = useContext(WindowControlsContext)
  if (windowControls === null) throw new Error('AppLayout 需要 WindowControlsProvider')
  return windowControls
}

/**
 * 渲染无边框窗口的自定义标题栏。
 * 通过入口注入的受限窗口能力请求操作，并订阅最大化状态来同步图标，避免布局直接访问 Electron 桥接对象。
 */
export function WindowTitlebar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const windowControls = useWindowControls()

  useEffect(() => windowControls.onMaximizedChange(setMaximized), [windowControls])

  return (
    <header
      className="window-titlebar"
      data-window-drag-region="true"
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('button') === null) {
          void windowControls.toggleMaximize()
        }
      }}
    >
      <span className="window-titlebar__name">{ZH_CN.appName}</span>
      <div className="window-titlebar__controls" aria-label="窗口控制">
        <button type="button" aria-label={ZH_CN.window.minimize} onClick={() => void windowControls.minimize()}>
          <MinusOutlined />
        </button>
        <button
          type="button"
          aria-label={ZH_CN.window.toggleMaximize}
          title={maximized ? '还原窗口' : '最大化窗口'}
          onClick={() => void windowControls.toggleMaximize()}
        >
          {maximized ? <ShrinkOutlined /> : <BorderOutlined />}
        </button>
        <button type="button" aria-label={ZH_CN.window.close} className="window-titlebar__close" onClick={() => void windowControls.close()}>
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
