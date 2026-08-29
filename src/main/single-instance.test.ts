import { expect, test } from 'vitest'
import { setupSingleInstance, type SingleInstanceApp } from './single-instance'

class FakeApplication implements SingleInstanceApp {
  quitCalls = 0
  private secondInstanceListener: ((event: unknown, commandLine: string[]) => void) | undefined

  constructor(private readonly lockGranted: boolean) {}

  requestSingleInstanceLock(): boolean {
    return this.lockGranted
  }

  quit(): void {
    this.quitCalls += 1
  }

  on(event: 'second-instance', listener: (event: unknown, commandLine: string[]) => void): this {
    if (event === 'second-instance') {
      this.secondInstanceListener = listener
    }
    return this
  }

  launchSecondInstance(commandLine: string[]): void {
    this.secondInstanceListener?.({}, commandLine)
  }
}

test('quits a secondary process when another instance owns the lock', () => {
  const app = new FakeApplication(false)
  const received: string[][] = []

  expect(setupSingleInstance(app, (paths) => received.push(paths))).toBe(false)
  expect(app.quitCalls).toBe(1)
  expect(received).toEqual([])
})

test('forwards supported paths from a later launch to the primary process', () => {
  const app = new FakeApplication(true)
  const received: string[][] = []

  expect(setupSingleInstance(app, (paths) => received.push(paths))).toBe(true)
  app.launchSecondInstance(['LecPDF.exe', 'C:\\books\\later.pdf', '--trace-warnings'])

  expect(received).toEqual([['C:\\books\\later.pdf']])
})
