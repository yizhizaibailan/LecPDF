import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'

const version = window.lec?.app.version ?? '开发模式'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App version={version} />
  </React.StrictMode>
)
