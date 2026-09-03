/**
 * 职责：定义 Foliate 阅读内核的最小受控边界，仅传递标准 ReaderEvent。
 * 异步说明：open 保留端口的异步打开语义，控制器不等待或创建阅读内核。
 * 安全说明：此层只接收调用方提供的字节与事件监听器，不访问 Electron 或 window.lec。
 * 资源说明：订阅返回幂等清理函数，确保同一订阅最多释放一次底层资源。
 */
import type { ReaderEvent } from '../../../types/reader'

/** 表示由后续 Foliate 适配实现注入的打开、关闭与标准事件订阅能力。 */
export type FoliateReaderPort = {
  open(bytes: ArrayBuffer): Promise<void>
  close(): void
  subscribe(listener: (event: ReaderEvent) => void): () => void
}

/** 表示页面可以使用的 Foliate 控制器；当前与端口保持同一受控契约。 */
export type FoliateReaderController = FoliateReaderPort

/** 创建不依赖 foliate-js 的 Foliate 控制器，并保证取消订阅只委托一次。 */
export function createFoliateReaderController(port: FoliateReaderPort): FoliateReaderController {
  return {
    open: (bytes) => port.open(bytes),
    close: () => port.close(),
    subscribe: (listener) => {
      const unsubscribe = port.subscribe(listener)
      let unsubscribed = false
      return () => {
        if (unsubscribed) return
        unsubscribed = true
        unsubscribe()
      }
    }
  }
}
