import { BorderOutlined, CloseOutlined, MinusOutlined, ShrinkOutlined } from '@ant-design/icons'
import { Empty, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { SolarIcon } from './SolarIcon'

type AppProps = {
  version: string
}

function WindowTitlebar(): JSX.Element {
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
      <span className="window-titlebar__name">LecPDF</span>
      <div className="window-titlebar__controls" aria-label="窗口控制">
        <button type="button" aria-label="最小化窗口" onClick={() => void window.lec.window.minimize()}>
          <MinusOutlined />
        </button>
        <button
          type="button"
          aria-label="最大化或还原窗口"
          title={maximized ? '还原窗口' : '最大化窗口'}
          onClick={() => void window.lec.window.toggleMaximize()}
        >
          {maximized ? <ShrinkOutlined /> : <BorderOutlined />}
        </button>
        <button type="button" aria-label="关闭窗口" className="window-titlebar__close" onClick={() => void window.lec.window.close()}>
          <CloseOutlined />
        </button>
      </div>
    </header>
  )
}

export function App({ version }: AppProps): JSX.Element {
  return (
    <div className="app-frame">
      <WindowTitlebar />
      <main className="project-shell">
        <section className="project-shell__card" aria-label="LecPDF 项目状态">
          <span className="project-shell__tag">LecPDF</span>
          <Empty
            image={<SolarIcon className="project-shell__icon" name="book-2-linear" width="72" aria-hidden />}
            description={
              <div className="project-shell__description">
                <Typography.Title level={1}>项目骨架已就绪</Typography.Title>
                <Typography.Text>版本 {version}</Typography.Text>
              </div>
            }
          />
        </section>
      </main>
    </div>
  )
}
