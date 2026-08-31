/**
 * 渲染层的唯一启动入口。
 * 在这里注入主题和全局样式，再挂载旧阅读页面；后续页面迁移不会改变 Electron-Vite 的入口路径。
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { lecTheme } from './config/theme'
import { App } from './renderer/src/App'
import './styles/index.css'

const version = window.lec.app.version

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={lecTheme}>
      <App version={version} />
    </ConfigProvider>
  </React.StrictMode>
)
