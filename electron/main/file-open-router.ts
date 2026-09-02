/**
 * 把命令行和二次启动携带的文件路由给现有窗口；通过队列在窗口未就绪时保留请求。
 */
import { extname } from 'node:path'
import { LIFECYCLE_IPC_CHANNELS } from '../shared/ipc'

export type FileRouteWindow = {
  isMinimized(): boolean
  restore(): void
  show(): void
  focus(): void
  webContents: {
    send(channel: string, path: string): void
  }
}

export function getSupportedDocumentPaths(commandLine: string[]): string[] {
  return [...new Set(commandLine.filter((argument) => {
    const extension = extname(argument).toLowerCase()
    return extension === '.pdf' || extension === '.epub'
  }))]
}

export class FileOpenRouter {
  private readonly pendingPaths: string[] = []

  enqueue(paths: string[]): void {
    this.pendingPaths.push(...paths)
  }

  flushTo(window: FileRouteWindow): void {
    const pendingPaths = this.pendingPaths.splice(0)
    this.routeTo(window, pendingPaths)
  }

  routeTo(window: FileRouteWindow, paths: string[]): void {
    if (paths.length === 0) {
      return
    }

    if (window.isMinimized()) {
      window.restore()
    }
    window.show()
    window.focus()

    for (const path of paths) {
      window.webContents.send(LIFECYCLE_IPC_CHANNELS.openFileRequest, path)
    }
  }
}
