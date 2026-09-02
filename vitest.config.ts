import { defineConfig } from 'vitest/config'

/**
 * 集中定义自动化测试的运行环境和扫描范围。
 * 构建配置位于项目根目录，因此需要显式纳入测试，避免目录重构后入口约定失去回归保护。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'electron/**/*.test.ts', 'electron.vite.config.test.ts'],
    pool: 'forks',
    maxWorkers: 1
  }
})
