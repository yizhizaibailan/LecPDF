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
