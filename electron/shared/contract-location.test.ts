import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

/**
 * 该回归测试保护共享 IPC/schema 的物理边界，防止目录迁移后又回退到项目根目录的 `shared` 文件夹。
 */
test('将 IPC 与数据 schema 放在 electron/shared 中', () => {
  expect(existsSync(fileURLToPath(new URL('./ipc.ts', import.meta.url)))).toBe(true)
  expect(existsSync(fileURLToPath(new URL('./schema.ts', import.meta.url)))).toBe(true)
  expect(existsSync(fileURLToPath(new URL('../types/window.d.ts', import.meta.url)))).toBe(true)
})
