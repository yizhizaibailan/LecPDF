/**
 * 维护当前窗口及最大化状态订阅；通过事件转发让无边框渲染标题栏同步显示状态。
 */
import { WINDOW_IPC_CHANNELS } from '../shared/ipc'

export type ManagedWindow = {
  minimize(): void
  isMaximized(): boolean
  maximize(): void
  unmaximize(): void
  close(): void
  on(event: 'maximize' | 'unmaximize', listener: () => void): unknown
  webContents: {
    send(channel: string, maximized: boolean): void
  }
}

export class WindowManager {
  constructor(private readonly getActiveWindow: () => ManagedWindow | null) {}

  observe(window: ManagedWindow): void {
    window.on('maximize', () => this.publishMaximizedState(window, true))
    window.on('unmaximize', () => this.publishMaximizedState(window, false))
  }

  minimize(): void {
    this.requireActiveWindow().minimize()
  }

  toggleMaximize(): void {
    const window = this.requireActiveWindow()
    if (window.isMaximized()) {
      window.unmaximize()
      return
    }

    window.maximize()
  }

  close(): void {
    this.requireActiveWindow().close()
  }

  private requireActiveWindow(): ManagedWindow {
    const window = this.getActiveWindow()
    if (window === null) {
      throw new Error('没有可用窗口')
    }
    return window
  }

  private publishMaximizedState(window: ManagedWindow, maximized: boolean): void {
    window.webContents.send(WINDOW_IPC_CHANNELS.maximizedChange, maximized)
  }
}
