/**
 * 把异常退出标记接入应用退出事件；通过仅在正常退出时写入 cleanExit 防止错误地跳过恢复提示。
 */
export type CrashMarkerLifecycleApp = {
  on(event: 'before-quit', listener: (event: { preventDefault(): void }) => void): void
  exit(exitCode?: number): void
}

export type CleanExitMarker = {
  markCleanExit(): Promise<void>
}

export function bindCrashMarkerCleanExit(app: CrashMarkerLifecycleApp, marker: CleanExitMarker): void {
  let isMarkingCleanExit = false

  app.on('before-quit', (event) => {
    if (isMarkingCleanExit) {
      return
    }

    isMarkingCleanExit = true
    event.preventDefault()
    void marker.markCleanExit()
      .catch(() => undefined)
      .finally(() => app.exit(0))
  })
}
