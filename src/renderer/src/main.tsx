import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { App } from './App'
import './styles.css'
import { lecTheme } from './theme'

const version = window.lec?.app.version ?? '开发模式'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={lecTheme}>
      <App version={version} />
    </ConfigProvider>
  </React.StrictMode>
)
