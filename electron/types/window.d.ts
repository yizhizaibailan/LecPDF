import type { LecApi } from '../shared/ipc'

/**
 * 声明渲染页面可见的唯一 Electron 桥接对象。
 * 该类型与 preload 暴露的 LecApi 共享同一契约，使页面在编译期无法调用未被授权的主进程能力。
 */
declare global {
  interface Window {
    lec: LecApi
  }
}

export {}
