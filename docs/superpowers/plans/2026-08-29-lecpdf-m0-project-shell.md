# LecPDF M0 项目骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可构建、可测试的 Windows 优先 Electron 阅读器骨架，启动一个空的无边框 LecPDF 窗口。

**Architecture:** Electron 主进程只负责窗口生命周期；preload 仅用 contextBridge 暴露版本只读信息；React 渲染进程显示空壳。将 BrowserWindow 选项抽成纯函数，以 Vitest 验证安全基线和无边框配置，不在单元测试中启动 Electron。

**Tech Stack:** pnpm、Electron 44、electron-vite、React 18、TypeScript、Ant Design 5、Zustand、Vitest。

**Spec:** `LecPDF-DEV-TASKS.md` 的 T0.1 / `LecPDF-ISSUES.md` 的 LEC-001。

## Global Constraints

- Windows v1；依赖精确锁定，不使用版本范围。
- BrowserWindow 必须 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`、`frame: false`。
- preload 不暴露 Node、文件系统或任意 IPC；仅暴露最小只读 `window.lec.app.version`。
- 所有新增行为先写 Vitest 失败测试，再写实现。
- 不接入 PDF/EPUB 引擎、不实现文件系统访问或风险能力。

---

### Task 1: 建立项目配置与测试运行器

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `pnpm dev`、`pnpm build`、`pnpm test:run` 与 `pnpm typecheck` 脚本。

- [x] **Step 1: 写入精确依赖和脚本配置**

配置 Electron 44、React 18、electron-vite、TypeScript、Vitest、Ant Design 与 Zustand；所有依赖使用精确版本。

- [x] **Step 2: 安装依赖并检查基础命令**

Run: `corepack pnpm install`

Expected: 生成 `pnpm-lock.yaml`，`corepack pnpm exec vitest --version` 成功。

### Task 2: 先验证安全窗口配置

**Files:**
- Create: `src/main/window-options.test.ts`
- Create: `src/main/window-options.ts`

**Interfaces:**
- Produces: `createMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions`。

- [x] **Step 1: 写失败测试**

```ts
import { expect, test } from 'vitest'
import { createMainWindowOptions } from './window-options'

test('creates a frameless, isolated and sandboxed reader window', () => {
  const options = createMainWindowOptions('C:/app/preload.js')

  expect(options.frame).toBe(false)
  expect(options.webPreferences).toMatchObject({
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    preload: 'C:/app/preload.js'
  })
})
```

- [x] **Step 2: 运行测试，确认因模块缺失失败**

Run: `corepack pnpm test:run -- src/main/window-options.test.ts`

Expected: FAIL，提示找不到 `window-options`。

- [x] **Step 3: 最小实现窗口选项**

实现纯函数，返回 `width: 1280`、`height: 800`、`minWidth: 1080`、`minHeight: 720`、`frame: false` 和上述安全 webPreferences。

- [x] **Step 4: 再次运行测试**

Run: `corepack pnpm test:run -- src/main/window-options.test.ts`

Expected: PASS。

### Task 3: 接通主进程、preload 和 React 空壳

**Files:**
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/styles.css`
- Create: `src/renderer/src/env.d.ts`

**Interfaces:**
- Consumes: `createMainWindowOptions()`。
- Produces: 空的 LecPDF 无边框窗口及 `window.lec.app.version: string`。

- [x] **Step 1: 编写 preload 声明和渲染壳**

仅显示应用名、版本和“项目骨架已就绪”；不新增文件打开或 Node 能力。

- [x] **Step 2: 接通窗口生命周期**

主进程在 `app.whenReady()` 后创建窗口，加载 renderer，并处理 macOS 之外的通用 window-all-closed 生命周期。

- [x] **Step 3: 运行全量验证**

Run: `corepack pnpm test:run; corepack pnpm typecheck; corepack pnpm build`

Expected: 全部 exit 0。

### Task 4: 提交 LEC-001

**Files:**
- Add: 本计划涉及的所有文件及 `pnpm-lock.yaml`

- [x] **Step 1: 检查提交内容**

Run: `git status --short; git diff --check`

Expected: 仅包含 LEC-001 的骨架、测试、配置与计划文件，无空白错误。

- [ ] **Step 2: 中文提交并推送**

Run: `git commit -m "feat: 初始化 LecPDF Electron 项目骨架"; git push -u origin feature/m0-project-shell`

Expected: 分支推送成功；提交编号用于向用户确认。
