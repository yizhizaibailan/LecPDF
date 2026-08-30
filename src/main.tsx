/**
 * 渲染层的新启动入口。
 * 在页面组件完全迁移前先复用旧启动模块，使 Electron-Vite 可以从根 `src` 目录启动且阅读功能保持不变。
 */
import './renderer/src/main'
