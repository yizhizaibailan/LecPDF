# LecPDF 目录重构与双阅读引擎设计

## 背景与目标

LecPDF 已具备 Electron 壳、数据层与 PDF 基础阅读能力，但渲染层的大部分界面逻辑仍集中在 `src/renderer/src/App.tsx`。本次重构以用户提供的 NeatReader2DeskApp `src` 目录截图为参考，将职责拆分为稳定、可定位的目录；同时明确 PDF 使用 EmbedPDF，非 PDF 电子书使用 Foliate 的浏览器内核 `foliate-js`。

目标如下：

- 目录边界清晰：Electron 进程代码、阅读引擎、渲染层业务代码彼此分离。
- 阅读引擎清晰：PDF 只经由 EmbedPDF；EPUB 与后续支持的非 PDF 书籍只经由 `foliate-js`。
- 既有 PDF 打开、缩放、目录、缩略图与搜索能力在迁移后保持可用。
- 新旧代码均补齐中文注释，说明职责、数据流与关键实现原因。
- 建立可勾选的开发清单，逐项实现、验证、提交后更新状态。

## 目标目录

```text
electron/
  main/                 # 主进程：窗口、文件协议、IPC、持久化、备份与更新
  preload/              # 预加载：向渲染层暴露最小化安全 API
  shared/               # 跨进程 IPC 契约与共享数据结构
  types/                # Electron 与窗口 API 的类型声明
engines/
  pdf/                  # EmbedPDF 适配层与 PDF 专属能力
  foliate/              # foliate-js 适配层与电子书专属能力
scripts/                # 打包、验证或数据维护脚本
src/
  components/           # 可复用的纯界面组件
  config/               # 常量、默认值和格式支持配置
  data/                 # 渲染层数据访问与数据转换
  db-api/               # 对 preload API 的领域化调用封装
  layouts/               # 应用框架、标题栏与阅读布局
  locales/               # 中文文案与未来多语言资源
  pages/                 # 路由页面组合
  reader/                # 阅读器通用状态、工具栏、侧栏与引擎视图组件
  router/                # 页面路由和外部文件打开分发
  stores/                # Zustand 状态仓库
  styles/                # 全局主题、变量和组件样式
  types/                 # 仅渲染层使用的类型
  utils/                 # 无 UI、无状态的通用函数
  main.tsx               # 渲染层启动入口
```

目录命名以截图为准；为了符合 Electron-Vite 的运行方式，原有 `src/main`、`src/preload`、`shared` 与 `src/renderer/engines` 将迁入对应的新目录，并同步更新构建入口与类型引用。

## 引擎边界

### PDF：EmbedPDF

- `engines/pdf` 只封装 EmbedPDF 的 React 组件、插件注册表与 PDF 专属操作。
- PDF 的缩放、翻页、旋转、目录、缩略图、搜索和后续批注能力均通过 EmbedPDF 的插件能力实现。
- PDF 文件内容继续由主进程的受限文件读取/协议提供，不向渲染层暴露任意路径读取能力。

### 非 PDF：foliate-js

- `engines/foliate` 只封装 `foliate-js`，不与 EmbedPDF 混用。
- 第一阶段接入 EPUB；格式支持表集中放在 `src/config`，后续由 Foliate 实际支持能力逐项开放。
- Foliate 的位置锚点、目录、搜索和选区数据转换为现有通用 `ReaderEngine` 契约，使页面与状态层不依赖具体阅读内核。
- 不把 Linux 原生 Foliate 桌面应用嵌入 Electron；Windows Electron 使用 `foliate-js` 浏览器内核。

## 渲染层数据流

```text
外部打开文件 / 页面操作
  -> router
  -> pages/ReaderPage
  -> stores/readerStore
  -> reader（工具栏、侧栏、阅读器视图）
  -> engines/pdf 或 engines/foliate
  -> db-api / data
  -> preload API
  -> electron/main
```

- `pages` 只组装页面，不保存引擎细节。
- `stores` 保存文档会话、视图偏好与界面状态；不直接调用 Electron IPC。
- `db-api` 是渲染层调用 `window.lec` 的唯一入口，负责参数校验和错误转换。
- `reader` 根据文档类型选择引擎视图，公共工具栏只依赖统一阅读状态。
- `engines` 不直接写业务存储；注释、阅读进度等由数据层持久化。

## 注释规范

本次迁移范围内的现有与新增 TypeScript/TSX 文件都按以下规则补充中文注释：

- 文件顶部：说明模块解决的问题、负责范围及与相邻层的关系。
- 每个导出的类型、常量、函数、类和 React 组件：说明“做什么”。
- 有输入输出转换、跨进程调用、资源释放、异步竞态、权限控制或阅读引擎适配的逻辑：说明“为何这样做”和“如何工作”。
- 条件分支仅在业务意图不直观时添加行内注释；不为语法本身重复写无价值注释，以保持代码可读性。
- 注释与实现同步维护，迁移时不改变已有行为的代码也要说明其保留行为。

## 迁移与兼容策略

1. 先建立目标目录、入口别名和最小路由，不删除原路径。
2. 按功能垂直切片迁移：窗口壳、PDF 阅读、数据访问、阅读状态与页面组合。
3. 每个切片完成后运行测试、类型检查和构建，再提交中文 Git 提交信息并推送。
4. 仅在新路径通过验证后删除对应旧文件；避免一次性移动造成大范围不可定位的回归。
5. `LecPDF-DEV-TASKS.md` 以外，新建专门的开发清单文档；每项完成并验证后立即勾选。

## 验收条件

- 项目目录与本设计的顶层结构一致，入口配置能正确指向新位置。
- 现有 PDF 打开、缩放、目录、缩略图与搜索测试仍通过。
- PDF 代码仅依赖 EmbedPDF；EPUB 代码仅依赖 `foliate-js`。
- 每个迁移或新增模块符合上述中文注释规范。
- 开发清单能反映每一项的未开始、进行中或已完成状态，并与提交记录对应。
