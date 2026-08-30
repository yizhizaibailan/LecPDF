import { describe, expect, it } from 'vitest'
import config from './electron.vite.config.ts'

/**
 * 该测试把目录重构需要的构建入口固定下来，避免 Electron-Vite 悄悄回退到旧的默认目录约定。
 */
describe('Electron-Vite 模块化目录入口', () => {
  it('从 electron 与根 src 目录构建三个进程入口', () => {
    const buildConfig = config as {
      main?: { build?: { rollupOptions?: { input?: Record<string, string> } } }
      preload?: { build?: { rollupOptions?: { input?: Record<string, string> } } }
      renderer?: { root?: string; build?: { rollupOptions?: { input?: Record<string, string> } } }
    }

    expect(buildConfig.main?.build?.rollupOptions?.input).toEqual({
      index: expect.stringMatching(/[\\/]electron[\\/]main[\\/]index\.ts$/)
    })
    expect(buildConfig.preload?.build?.rollupOptions?.input).toEqual({
      index: expect.stringMatching(/[\\/]electron[\\/]preload[\\/]index\.ts$/)
    })
    expect(buildConfig.renderer?.root).toBe('.')
    expect(buildConfig.renderer?.build?.rollupOptions?.input).toEqual({
      index: expect.stringMatching(/[\\/]index\.html$/)
    })
  })
})
