import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/**
 * 项目根目录由当前配置文件推导，避免开发命令从其他工作目录启动时解析到错误入口。
 */
const projectRoot = fileURLToPath(new URL('.', import.meta.url))

/**
 * 模块化目录重构后的三个构建入口。
 * Electron-Vite 默认只识别 `src/main`、`src/preload` 和 `src/renderer`，因此这里显式声明新路径。
 */
const buildEntries = {
  main: resolve(projectRoot, 'electron/main/index.ts'),
  preload: resolve(projectRoot, 'electron/preload/index.ts'),
  renderer: resolve(projectRoot, 'index.html')
}

/**
 * 同时构建主进程、预加载脚本与渲染层，并提供跨目录导入别名。
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: buildEntries.main }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: buildEntries.preload },
        output: {
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: { index: buildEntries.renderer },
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) {
            return
          }
          warn(warning)
        }
      }
    },
    resolve: {
      alias: {
        '@app': resolve(projectRoot, 'src'),
        '@electron': resolve(projectRoot, 'electron'),
        '@engines': resolve(projectRoot, 'engines'),
        '@renderer': resolve(projectRoot, 'src/renderer/src')
      }
    }
  }
})
