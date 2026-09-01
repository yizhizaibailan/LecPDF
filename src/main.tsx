/**
 * 渲染层的唯一启动入口。
 * 在这里创建唯一的 preload 组合根，注入页面所需能力并挂载应用壳；页面不再自行访问 Electron 桥接对象。
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { lecTheme } from './config/theme'
import { createAppRuntime } from './config/app-runtime'
import { WindowControlsProvider } from './layouts/AppLayout'
import { ApplicationPage } from './pages/ApplicationPage'
import './styles/index.css'

const lec = window.lec
const runtime = createAppRuntime(lec)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={lecTheme}>
      <WindowControlsProvider windowControls={lec.window}>
        <ApplicationPage runtime={runtime} lifecycle={lec.lifecycle} dialogs={lec.dialogs} />
      </WindowControlsProvider>
    </ConfigProvider>
  </React.StrictMode>
)
