/**
 * 建立单实例锁并接收后续进程传入的文件；通过规范化参数后回调路由器避免多窗口竞争。
 */
import { getSupportedDocumentPaths } from './file-open-router'

export type SingleInstanceApp = {
  requestSingleInstanceLock(): boolean
  quit(): void
  on(event: 'second-instance', listener: (event: unknown, commandLine: string[]) => void): unknown
}

export function setupSingleInstance(app: SingleInstanceApp, onOpenFiles: (paths: string[]) => void): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return false
  }

  app.on('second-instance', (_event, commandLine) => {
    onOpenFiles(getSupportedDocumentPaths(commandLine))
  })
  return true
}
