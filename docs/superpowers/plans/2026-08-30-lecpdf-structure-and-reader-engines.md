# LecPDF 目录重构与双阅读引擎实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 LecPDF 重构为参考截图中的模块化目录，并以 EmbedPDF 承担 PDF 阅读、以 foliate-js 承担非 PDF 电子书阅读，同时补齐既有与新增代码的中文注释。

**Architecture:** Electron 进程代码迁入 `electron/`，阅读内核迁入 `engines/`，界面业务迁入根目录 `src/` 的组件、页面、阅读器和状态目录。页面只协调状态和视图；阅读引擎通过明确的适配层实现；所有跨进程读写仍经由 preload 的受限 API。

**Tech Stack:** Electron 44、electron-vite、React 18、TypeScript 5、Zustand、EmbedPDF、foliate-js、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-30-lecpdf-structure-and-reader-engines-design.md`

## Global Constraints

- PDF 阅读能力只依赖 `@embedpdf/react-pdf-viewer` 与 `@embedpdf/models`。
- EPUB 及后续非 PDF 电子书阅读只通过 `foliate-js` 适配层实现。
- 不在渲染进程直接读取任意本地路径；文件访问必须继续通过 preload 与主进程的受限 IPC。
- 所有迁移和新增的 `.ts`、`.tsx` 文件均须补充中文注释：文件职责、导出项用途及关键数据流/分支原因。
- 每一个任务完成后必须更新本文件的复选框、运行对应验证、使用中文提交信息提交并推送。
- 不删除旧路径中的文件，直到新路径的测试、类型检查与生产构建都通过。

---

## 文件结构目标

| 目标路径 | 职责 | 来源/依赖 |
| --- | --- | --- |
| `electron/main/` | 窗口、IPC、文件协议、存储、备份、更新 | 原 `src/main/` |
| `electron/preload/` | 白名单 API 与渲染层类型桥接 | 原 `src/preload/` |
| `electron/shared/` | IPC channel 与跨进程 schema | 原 `shared/` |
| `electron/types/` | `window.lec` 与 Electron 环境声明 | 新建/迁入渲染声明 |
| `engines/pdf/` | EmbedPDF 适配与 PDF 专属能力 | 原 `src/renderer/engines/pdf/` |
| `engines/foliate/` | foliate-js 适配与 EPUB 专属能力 | 原 `src/renderer/engines/epub/` |
| `src/components/` | 可复用、无业务状态的组件 | 从 `App.tsx` 拆分 |
| `src/config/` | 文件格式、默认阅读设置 | 新建 |
| `src/data/` | sidecar/导入导出等数据转换 | 新建 |
| `src/db-api/` | 渲染层的 preload API 封装 | 新建 |
| `src/layouts/` | 标题栏与阅读页面框架 | 从 `App.tsx` 拆分 |
| `src/locales/` | 中文 UI 文案 | 新建 |
| `src/pages/` | 页面组合 | 从 `App.tsx` 拆分 |
| `src/reader/` | 公共阅读器 UI、PDF/Foliate 视图 | 从 `App.tsx` 拆分 |
| `src/router/` | 文档类型分发与启动文件路由 | 新建 |
| `src/stores/` | 会话和界面 Zustand 状态 | 新建 |
| `src/styles/` | 全局与阅读器样式 | 原 `styles.css` |
| `src/types/` | 渲染层局部类型 | 从 `App.tsx` 拆分 |
| `src/utils/` | 纯函数工具 | 新建 |

## 开发清单

### Task 1：建立目标目录、构建入口与路径守卫

**Files:**

- Create: `electron/main/`、`electron/preload/`、`electron/shared/`、`electron/types/`、`engines/pdf/`、`engines/foliate/`
- Modify: `electron.vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`tsconfig.web.json`
- Test: `electron.vite.config.test.ts`（如配置抽取为可测试函数）

**Interfaces:**

- Consumes: Electron-Vite 的 `main`、`preload`、`renderer` 入口约定。
- Produces: `@electron/*`、`@engines/*`、`@app/*` 路径别名，以及指向新目录的构建入口。

- [x] 写一个配置断言，验证主进程和 preload 入口均位于 `electron/`，渲染入口为 `src/main.tsx`。

```ts
expect(resolveBuildEntries()).toEqual({
  main: 'electron/main/index.ts',
  preload: 'electron/preload/index.ts',
  renderer: 'src/main.tsx'
})
```

- [x] 运行该测试，确认旧入口下断言失败或入口尚未存在。
- [x] 创建目标目录并迁入入口文件；修改 Electron-Vite 与 TypeScript 别名，使构建只解析新入口。
- [x] 在迁入的入口和配置处写中文模块注释，说明进程边界及为何使用别名。
- [x] 运行 `corepack pnpm typecheck`、`corepack pnpm build` 与 `corepack pnpm test:run`。
- [x] 将本任务标记为完成，提交 `refactor: 建立模块化目录与构建入口` 并推送。

### Task 2：迁移共享契约、主进程与 preload，并补齐注释

**Files:**

- Move: `shared/schema.ts`、`shared/ipc.ts` 到 `electron/shared/`
- Move: `src/main/*.ts` 到 `electron/main/`
- Move: `src/preload/*.ts` 到 `electron/preload/`
- Create: `electron/types/window.d.ts`
- Modify: 所有受上述路径影响的测试及导入。

**Interfaces:**

- Consumes: 既有 `LecApi`、`DATA_IPC_CHANNELS`、`SIDECAR_IPC_CHANNELS` 和主进程 IPC 注册逻辑。
- Produces: `window.lec: LecApi` 的统一声明；主、预加载和共享层只有 `@electron/*` 引用。

- [x] 先为 `LecApi`、IPC channel、sidecar 路径和受限文件协议分别写/更新回归测试，覆盖合法调用与越界路径拒绝。
- [x] 运行相关测试，记录迁移前的通过结果。
- [x] 移动共享、主进程和预加载文件，逐一修正导入路径；不改变 IPC channel 字符串或权限判断。
- [x] 给每个迁移文件增加中文文件注释；为导出的 IPC handler、存储服务和 preload 方法说明输入、输出与安全边界。
- [x] 运行 `corepack pnpm test:run`、`corepack pnpm typecheck`、`corepack pnpm build`。
- [x] 将本任务标记为完成，提交 `refactor: 迁移 Electron 进程与共享契约` 并推送。

### Task 3：建立渲染层基础目录、文案与应用框架

**Files:**

- Create: `src/config/reader-formats.ts`、`src/locales/zh-CN.ts`、`src/layouts/AppLayout.tsx`
- Move: `src/renderer/src/main.tsx` 到 `src/main.tsx`
- Move: `src/renderer/src/theme.ts` 到 `src/config/theme.ts`
- Move: `src/renderer/src/styles.css` 到 `src/styles/index.css`
- Move: `src/renderer/src/SolarIcon.tsx` 到 `src/components/SolarIcon.tsx`
- Test: `src/config/reader-formats.test.ts`、`src/layouts/AppLayout.test.tsx`

**Interfaces:**

- Consumes: `window.lec.window` 与既有主题 token。
- Produces: `isSupportedDocument(path): boolean`、`detectReaderKind(path): 'pdf' | 'foliate' | null`、`AppLayout`。

- [x] 写格式识别测试：`.PDF` 返回 `pdf`，`.epub` 返回 `foliate`，不受支持的扩展名返回 `null`。

```ts
expect(detectReaderKind('BOOK.PDF')).toBe('pdf')
expect(detectReaderKind('book.epub')).toBe('foliate')
expect(detectReaderKind('notes.txt')).toBeNull()
```

- [x] 运行该测试，确认新模块不存在时失败。
- [x] 创建格式配置、中文文案、`AppLayout` 与样式目录；将标题栏从旧 `App.tsx` 拆入布局层。
- [x] 给格式表说明“PDF 与 Foliate 的选择规则”，给标题栏说明“无边框窗口控制的数据流”。
- [x] 运行相关组件测试、`corepack pnpm typecheck` 和 `corepack pnpm build`。
- [x] 将本任务标记为完成，提交 `refactor: 建立渲染层基础目录与应用框架` 并推送。

### Task 4：建立路由、会话状态与领域化数据访问

**Files:**

- Create: `src/router/document-router.ts`、`src/router/AppRouter.tsx`
- Create: `src/stores/reader-store.ts`
- Create: `src/db-api/document-api.ts`、`src/data/document-session.ts`
- Create: `src/types/reader.ts`
- Test: `src/router/document-router.test.ts`、`src/stores/reader-store.test.ts`

**Interfaces:**

- Consumes: `detectReaderKind(path)`、`window.lec.fileRead.getPdfUrl(path)` 和 `window.lec.lifecycle.onOpenFileRequest(listener)`。
- Produces: `openDocument(path): Promise<void>`、`ReaderSession`、`useReaderStore`。

- [ ] 写路由测试，验证 PDF 分派到 `pdf`，EPUB 分派到 `foliate`，未知格式返回包含路径的可展示错误。
- [ ] 写 Zustand 状态测试，验证打开文档时清除旧错误、关闭文档时释放当前会话。
- [ ] 运行测试，确认在状态模块未实现时失败。
- [ ] 实现 `document-api` 作为唯一 `window.lec` 访问入口；实现路由和状态仓库，但不在 store 内直接调用 IPC。
- [ ] 对异步文件打开的旧请求取消/忽略策略写注释，避免后返回的请求覆盖当前文档。
- [ ] 运行 `corepack pnpm test:run`、`corepack pnpm typecheck`、`corepack pnpm build`。
- [ ] 将本任务标记为完成，提交 `feat: 建立文档路由与阅读会话状态` 并推送。

### Task 5：抽离并验证 EmbedPDF 阅读器

**Files:**

- Move/Create: `engines/pdf/embedpdf-adapter.ts`、`src/reader/pdf/PdfReaderView.tsx`
- Create: `src/reader/PdfToolbar.tsx`、`src/reader/PdfSidebar.tsx`、`src/reader/PdfSearchBar.tsx`
- Create: `src/reader/types.ts`
- Modify: `src/pages/ReaderPage.tsx`
- Test: `engines/pdf/embedpdf-adapter.test.ts`、`src/reader/pdf/PdfReaderView.test.tsx`

**Interfaces:**

- Consumes: `ReaderSession` 的 PDF URL 与 `@embedpdf/react-pdf-viewer` 的 `PluginRegistry`。
- Produces: `PdfReaderView({ sourceUrl, onReady })`、`PdfReaderController`，包含缩放、跳页、旋转、搜索、目录和缩略图能力。

- [ ] 先写 PDF 视图测试：没有源地址时不渲染 `PDFViewer`；给定源地址时传入 EmbedPDF 配置。
- [ ] 先写控制器测试，验证页码输入会限制为 `1..totalPages`，且搜索空词会停止搜索。
- [ ] 运行测试，确认拆分前的模块无法满足新接口。
- [ ] 从旧 `App.tsx` 迁移 PDF 工具栏、搜索、目录和缩略图组件；只通过 `embedpdf-adapter` 获取插件能力。
- [ ] 在 `embedpdf-adapter` 文件顶部明确注释“PDF 只能使用 EmbedPDF”，并在对象 URL 生命周期、插件订阅取消和缩略图 URL 回收处写实现原因。
- [ ] 运行 `corepack pnpm test:run`、`corepack pnpm typecheck`、`corepack pnpm build`。
- [ ] 将本任务标记为完成，提交 `refactor: 拆分 EmbedPDF 阅读器与控制组件` 并推送。

### Task 6：接入 foliate-js 与 EPUB 最小阅读闭环

**Files:**

- Modify: `package.json`、`pnpm-lock.yaml`、`src/config/reader-formats.ts`
- Create: `engines/foliate/foliate-adapter.ts`、`engines/foliate/foliate-types.ts`
- Create: `src/reader/foliate/FoliateReaderView.tsx`
- Modify: `src/pages/ReaderPage.tsx`、`src/db-api/document-api.ts`
- Test: `engines/foliate/foliate-adapter.test.ts`、`src/reader/foliate/FoliateReaderView.test.tsx`

**Interfaces:**

- Consumes: `foliate-js`、`ReaderSession`、安全的文档字节读取 API。
- Produces: `createFoliateReader(source): Promise<FoliateReader>`，具备 `open`、`close`、`getOutline`、`goTo`、`search` 与 `getLocation`。

- [ ] 添加 `foliate-js` 依赖并记录锁文件；先写适配层测试，以注入的最小 Foliate 工厂替代真实 DOM。

```ts
const reader = await createFoliateReader({
  bytes: new Uint8Array([0x50, 0x4b]),
  factory: fakeFoliateFactory
})
expect(reader.kind).toBe('foliate')
expect(fakeFoliateFactory.open).toHaveBeenCalledOnce()
```

- [ ] 运行测试，确认在适配层不存在时失败。
- [ ] 实现 Foliate 适配层和 EPUB 阅读视图；将 Foliate 的位置、目录与搜索结果转换为通用阅读器类型。
- [ ] 在适配层注释 Foliate Web 内核与原生 Foliate 的区别；在文件字节传递和关闭资源处说明安全与释放原因。
- [ ] 验证打开 EPUB 时显示 Foliate 视图，PDF 时仍只显示 EmbedPDF 视图。
- [ ] 运行 `corepack pnpm test:run`、`corepack pnpm typecheck`、`corepack pnpm build`。
- [ ] 将本任务标记为完成，提交 `feat: 接入 foliate-js EPUB 阅读器` 并推送。

### Task 7：完成 ReaderPage 与公共阅读体验

**Files:**

- Create: `src/pages/ReaderPage.tsx`、`src/pages/StartPage.tsx`
- Create: `src/reader/ReaderWorkspace.tsx`、`src/reader/ReaderErrorState.tsx`
- Modify: `src/router/AppRouter.tsx`、`src/layouts/AppLayout.tsx`
- Test: `src/pages/ReaderPage.test.tsx`、`src/router/AppRouter.test.tsx`

**Interfaces:**

- Consumes: `useReaderStore`、`PdfReaderView`、`FoliateReaderView`。
- Produces: 从启动文件到对应阅读器视图的完整页面路径，并显示可理解的加载、错误和空白状态。

- [ ] 写页面测试：无会话显示开始页；PDF 会话显示 PDF 视图；Foliate 会话显示 Foliate 视图；打开失败显示错误状态。
- [ ] 运行测试，确认重构前单体 `App.tsx` 不满足页面边界。
- [ ] 实现页面组合与路由，移除单体 `App.tsx` 中的业务 UI；保留最小应用启动组件。
- [ ] 注释路由分发条件以及错误状态不泄露本地绝对路径的原因。
- [ ] 运行 `corepack pnpm test:run`、`corepack pnpm typecheck`、`corepack pnpm build`。
- [ ] 将本任务标记为完成，提交 `feat: 完成统一阅读页面与格式分发` 并推送。

### Task 8：补齐既有与新增代码的中文注释

**Files:**

- Modify: `electron/**/*.ts`、`engines/**/*.ts`、`src/**/*.ts`、`src/**/*.tsx`
- Exclude: 自动生成文件、构建输出、依赖目录与纯测试断言文本。
- Test: `scripts/check-code-comments.mjs`、`scripts/check-code-comments.test.ts`（如使用可测试的检查函数）

**Interfaces:**

- Consumes: 注释规范与迁移后的文件清单。
- Produces: 代码注释检查脚本，输出缺少文件说明或导出说明的文件路径。

- [ ] 先写检查脚本测试：缺少文件头注释的 TypeScript 文件被报告；带模块说明与导出说明的文件通过。
- [ ] 运行测试，确认检查器未实现时失败。
- [ ] 编写检查脚本；逐文件补充中文模块说明、导出项说明和关键逻辑说明，保持测试语义不变。
- [ ] 对不需要行内注释的直观声明保留简洁写法；对 IPC、资源释放、异步请求和引擎映射必须解释原因。
- [ ] 运行 `node scripts/check-code-comments.mjs`、`corepack pnpm test:run`、`corepack pnpm typecheck`、`corepack pnpm build`。
- [ ] 将本任务标记为完成，提交 `docs: 补充全项目中文代码注释` 并推送。

### Task 9：删除已迁移旧路径、全量验收与文档收尾

**Files:**

- Delete: 已被新路径替代且没有引用的 `src/main/`、`src/preload/`、`src/renderer/`、旧 `shared/` 文件。
- Modify: `LecPDF-ARCHITECTURE.md`、`LecPDF-DEV-TASKS.md`、本文件。
- Test: 全量 Vitest、TypeScript、Electron-Vite 生产构建。

**Interfaces:**

- Consumes: Tasks 1–8 的已通过构建与测试结果。
- Produces: 无旧路径引用的工程、更新后的架构说明与全勾选开发清单。

- [ ] 使用 `rg "src/(main|preload|renderer)|from ['\"]\.\./shared"` 检查旧路径引用，并逐一替换或确认不存在。
- [ ] 仅删除已经通过新路径测试覆盖的旧文件；删除前记录精确文件列表。
- [ ] 更新架构文档，说明最终目录、EmbedPDF 与 foliate-js 的职责边界。
- [ ] 逐项复核本清单，勾选已验证项目；未完成项目必须保持未勾选并记录原因。
- [ ] 运行 `git diff --check`、`corepack pnpm test:run`、`corepack pnpm typecheck`、`corepack pnpm build`。
- [ ] 将本任务标记为完成，提交 `refactor: 完成阅读器目录重构与全量验收` 并推送。

## 计划自检记录

- [x] 设计文档的目录、引擎边界、注释规范、迁移策略和验收条件均对应至少一个任务。
- [x] 每项任务都列出精确路径、输入输出接口、测试先行步骤、验证命令和中文提交信息。
- [x] 任务之间的类型名称一致：`ReaderSession`、`useReaderStore`、`PdfReaderView`、`FoliateReaderView` 与 `createFoliateReader` 在后续任务中沿用同名接口。
- [x] 未使用未定义占位项、延后实现描述或省略测试的任务描述。
