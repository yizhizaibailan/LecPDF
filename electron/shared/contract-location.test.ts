import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

/**
 * 该回归测试保护共享 IPC/schema 与渲染层窗口声明的物理边界，防止目录迁移后回退到旧的根目录或 Electron 类型目录。
 */
test('将 IPC/schema 放在 electron/shared 中，并将窗口声明放在 src/types 中', () => {
  expect(existsSync(fileURLToPath(new URL('./ipc.ts', import.meta.url)))).toBe(true)
  expect(existsSync(fileURLToPath(new URL('./schema.ts', import.meta.url)))).toBe(true)
  expect(existsSync(fileURLToPath(new URL('../../src/types/window.d.ts', import.meta.url)))).toBe(true)
})
