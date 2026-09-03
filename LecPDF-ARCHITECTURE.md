# LecPDF 架构与数据结构设计

> 版本：v2.2（模块化重构 + 单向数据流 + PDF 适配层收口） · 日期：2026-09-03
> 上游依赖：`LecPDF-FRD.md`（40 项决策）。本文档给出：整体架构图 → 模块划分与职责 → 模块间数据流转 → 接口契约 → 数据模型 → 关键流程。

---

## 1. 技术选型

| 层 | 选型 | 依据 |
|---|---|---|
| 桌面壳 | Electron（主进程 + 渲染进程） | FRD 决策 #1；渲染层保持平台无关 |
| 渲染框架 | React 18 + TypeScript | 已确认（2026-08-27） |
| UI 组件 | Ant Design 5（antd） | FRD 决策 #8 |
| 状态管理 | Zustand | 已确认（2026-08-27） |
| PDF 引擎 | embedpdf v2 稳定分支 | 已确认；v3 官方不推荐生产 |
| EPUB / 非 PDF 电子书引擎 | foliate-js（仅经适配层接入） | 已确认；不得引入 epub.js |
| i18n | i18next + react-i18next | FRD 决策 #16 |
| 日志 | electron-log（本地文件） | FRD 决策 #32 零遥测 |
| 更新 | electron-updater（检查+提示） | FRD 决策 #24 |
| 打包 | electron-builder（NSIS，Windows 先行） | FRD 决策 #15 |
| 数据存储 | 本地 JSON（userData）+ 原子写 | FRD 决策 #7/#23/#34 |
| 构建 | electron-vite + pnpm | 已确认（2026-08-27） |

---

## 2. 整体架构图

```
┌═══════════════════════════════ 操作系统 / 用户 ═══════════════════════════════┐
│   双击文件关联 · 拖放文件 · 命令行参数 · 窗口操作 · 打印对话框                 │
└═══════════════════════════════════┬───────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────────────┐
│                        【主进程】 Electron Main Process                        │
│                                                                               │
│  ┌──────────────┐   ┌───────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ WindowManager│   │SingleInstance │   │ProtocolSvc   │   │ LibrarySvc   │  │
│  │ frameless窗口│   │ 单实例锁      │   │ lec-file://  │   │ 目录扫描     │  │
│  │ 几何记忆     │   │ 二次启动路由  │   │ 流式读PDF    │   │ 索引元数据   │  │
│  └──────┬───────┘   └───────┬───────┘   └──────┬───────┘   └──────┬───────┘  │
│  ┌──────┴───────┐   ┌───────┴───────┐   ┌──────┴───────┐   ┌──────┴───────┐  │
│  │ DataStoreSvc │   │ BackupSvc     │   │ UpdateSvc    │   │ CrashMarker  │  │
│  │ JSON 原子读写│   │ 自动备份      │   │ 更新检查     │   │ 启动/退出标记│  │
│  └──────┬───────┘   │ 导出/导入     │   └──────┬───────┘   └──────┬───────┘  │
│         │           └───────┬───────┘          │                  │          │
│  ┌──────┴───────────────────┴──────────────────┴──────────────────┴───────┐  │
│  │                          Logger（electron-log → logs/）                │  │
│  └──────────────────────────────────────┬──────────────────────────────────┘  │
│                                         │                                     │
│                        ┌────────────────┴─────────────────┐                   │
│                        │          userData/ 磁盘           │                   │
│                        │ config/library/runtime/data/cache │                   │
│                        │ backups/  logs/                   │                   │
│                        └────────────────▲─────────────────┘                   │
└─────────────────────────────────────────┼─────────────────────────────────────┘
                                          │ IPC（contextBridge，window.lec.*）
                                          │  ① 窗口控制  ② 对话框  ③ 文件系统
                                          │  ④ 目录扫描  ⑤ JSON 读写 ⑥ 备份/更新
┌─────────────────────────────────────────┼─────────────────────────────────────┐
│                        【preload】 IPC Bridge（类型安全契约）                  │
│                 window.lec = { window, dialogs, fs, library,                  │
│                 fileRead, data, backup, update, lifecycle }                   │
└─────────────────────────────────────────┼─────────────────────────────────────┘
                                          │ 仅此一处触达主进程
┌─────────────────────────────────────────▼─────────────────────────────────────┐
│                        【渲染进程】 React SPA（产品面）                         │
│                                                                               │
│  ┌────────────────────────────┐      ┌────────────────────────────────────┐  │
│  │  Shell 外壳层               │      │  Pages 页面层                       │  │
│  │ · 标题栏(菜单/窗口三键)     │      │ · StartPage 开始页                 │  │
│  │ · Tabs 标签页管理           │      │ · Reader 阅读器(引擎宿主)          │  │
│  │ · 全局快捷键分发            │      │ · Settings 设置页                  │  │
│  └──────────────┬─────────────┘      └───────────────┬────────────────────┘  │
│                 │         ┌──────────────┬───────────┴──────────┐            │
│                 │         │   Stores 状态层 (zustand)           │            │
│                 │         │ tabs │ library │ settings │ fileData │ ui        │
│                 │         └──────┬───────┴────┬───────┴────┬─────┘            │
│  ┌──────────────▼──────────┐     │            │            │                  │
│  │  Features 功能层         │     │            │            │                  │
│  │ · annotations 批注管理   │◄────┘            │            │                  │
│  │ · bookmarks 书签         │                  │            │                  │
│  │ · search 文档内搜索      │                  │            │                  │
│  │ · tts 朗读(仅EPUB)       │                  │            │                  │
│  │ · library 文件库逻辑     │                  │            │                  │
│  └──────────────┬──────────┘                  │            │                  │
│  ┌──────────────▼──────────────────────────┐  │            │                  │
│  │  Data 数据访问层                          │  │            │                  │
│  │ · sidecar 防抖写(500ms) · undo/redo 栈   │  │            │                  │
│  │ · 锚点失效重定位 · schema 迁移           │  │            │                  │
│  └──────────────┬──────────────────────────┘  │            │                  │
│  ┌──────────────▼─────────────────────────────────────────▼───────────────┐  │
│  │  Engines 引擎适配层（ReaderEngine 统一接口）                              │  │
│  │  ┌─────────────────────┐        ┌─────────────────────┐                  │  │
│  │  │ PDF 适配器           │        │ EPUB 适配器          │                  │  │
│  │  │ EmbedPDF + 插件      │        │ foliate-js          │                  │  │
│  │  │ (annotations/search/ │        │ (toc/搜索/TTS/设置) │                  │  │
│  │  │  thumbs/outline)     │        │                     │                  │  │
│  │  └──────────┬──────────┘        └──────────┬──────────┘                  │  │
│  │             └────────── 引擎原生渲染层 ──────┘                            │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Workers 工作线程（页数提取 / EPUB 解析重活）                              │  │
│  │  i18n（中英资源）  theme（antd tokens，浅/深/跟随系统）                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**核心原则**：主进程只管"系统面"，渲染进程管"产品面"；渲染层唯一接触主进程的通道是 preload 的 `window.lec`（换壳时只重写此层）。所有业务数据在渲染层内存态（stores），持久化统一经 Data 访问层 → IPC → DataStoreSvc 原子写盘。

### 2.1 当前已落地的 PDF 边界（2026-09-03）

`src/data/readers/pdf` 是唯一允许直接导入 `@embedpdf/*` 的目录：它拥有 `PluginRegistry`、`PDFViewer` 配置、页码/目录/搜索端口、缩略图对象 URL 与滚动/尺寸订阅的释放。`PdfReaderPage` 只组合由运行时提供的标准控制器与不透明视图插槽；工具栏、搜索栏和导航侧栏只消费页码、目录、搜索等序列化状态与命令，不能导入 EmbedPDF、foliate-js、Electron 或 `window.lec`。

这里的 `PluginRegistry`、DOM 引用、`ResizeObserver`、对象 URL 和插件回调都是与视图同寿命的临时资源，故不进入 Zustand。Zustand 仍是跨页面、跨标签且需要重渲染的业务状态唯一来源；内核临时资源由适配运行时创建，并在对应 React effect 卸载时释放。

```text
用户动作 → 受控组件 → 标准控制器 → PDF 适配端口 → EmbedPDF
EmbedPDF 事件 → PDF 适配端口 → 标准状态 → 受控组件重渲染
跨标签/可持久化状态 → Zustand Action → Store → UI selector
```

### 2.2 统一阅读会话与受控引擎边界（2026-09-03）

`ReaderEvent → readerStore.applyEvent → selector UI` 是阅读状态的唯一闭环：PDF 运行时把内核页码、目录等变化转换为 `ReaderEvent`，`ApplicationPage` 将事件交给目标标签的 `readerStore.applyEvent`，页面与侧栏再通过 selector 读取同一份可序列化会话快照。事件不会把 EmbedPDF 类型、DOM 引用或引擎实例泄露给组件、页面或 Store。

`DocumentSessionRegistry` 只拥有短生命周期资源：打开期间的文件字节、`lec-file://` 来源、对象 URL（如有）、内核实例及取消订阅函数。标签关闭或异步打开结果失效时，注册表负责释放这些资源；Zustand 只保存 `ReaderSession` 的状态、位置、目录、搜索、视图偏好和错误，绝不保存上述资源。

当前状态须明确区分：PDF 已完成受控适配器事件接线，可将阅读事件回写 Store；Foliate 已完成不导入 `foliate-js` 的端口与控制器**骨架**，用于约束未来的打开、关闭和订阅边界。Foliate 的实际包接入、EPUB 打开与真实渲染仍待技术验证，尚未作为已完成功能宣称。

架构检查扫描全部非测试 `src/**/*.ts(x)`：`@embedpdf/*` 仅可由 `src/data/readers/pdf/` 导入，`foliate-js` 仅可由 `src/data/readers/foliate/` 导入；组件、页面与 Store 均不得直接接触任一内核、Electron 或 `window.lec`。

---

## 3. 模块划分与职责

### 3.1 主进程模块

| 模块 | 独立职责 | 依赖 | 对外接口（IPC 通道） |
|---|---|---|---|
| **WindowManager** | frameless 窗口创建、几何记忆/越界回退、最大化状态同步 | electron | `window.minimize/maximize/close`、`onMaximizedChange` |
| **SingleInstance** | 单实例锁；二次启动捕获命令行文件路径并路由到已开窗口 | WindowManager | `lifecycle.onOpenFileRequest` |
| **ProtocolSvc** | 注册 `lec-file://` 协议，流式读取本地 PDF 供引擎拉取 | electron protocol | 无（渲染层直接用 URL） |
| **LibrarySvc** | 目录扫描（readdir+stat，不解析内容）→ 文件元数据列表 | electron fs | `library.scanFolders` |
| **DataStoreSvc** | config/library/sidecar/runtime 的 JSON 读写，原子写（tmp+rename），读写互斥 | electron fs | `data.readJson/writeJson` |
| **BackupSvc** | 定时自动备份（周/轮转 3 份）、手动导出、导入重映射 | DataStoreSvc | `backup.runBackup/exportData/importData` |
| **UpdateSvc** | electron-updater 检查新版本，返回版本信息（不静默安装） | electron-updater | `update.checkForUpdates` |
| **CrashMarker** | 启动写 `cleanExit=false`、正常退出置 `true`、记录 lastTabPaths | DataStoreSvc | 无（内部自动） |
| **Logger** | electron-log 落盘 logs/；被所有主进程模块调用 | — | `lifecycle.openLogsFolder` |

### 3.2 渲染进程模块

| 模块 | 独立职责 | 依赖 | 不负责 |
|---|---|---|---|
| **Shell** | 标题栏（应用菜单/窗口三键）、标签页增删切换（上限 20）、全局快捷键注册与分发 | ui store、window.lec.window | 不做引擎操作、不碰业务数据 |
| **Pages/StartPage** | 最近/星标/我的文档/聚合视图的展示与交互、文件打开入口（对话框/拖放/重定位） | library store、Features/library、window.lec.dialogs/fs | 不直接读写磁盘 |
| **Pages/Reader** | 阅读器容器：工具栏、侧栏（缩略图/目录/书签/批注）、状态栏、渲染视口 | Engines、Features、fileData store | 不感知引擎差异 |
| **Pages/Settings** | 5 组设置表单、快捷键改键与冲突检测、缓存占用展示/清理、导出入口 | settings store、window.lec.backup | 不直接写 config |
| **data/readers（适配层）** | 将 PDF/EPUB 引擎差异（坐标、锚点、批注格式）全部封死在适配层；当前 PDF 使用标准控制器，后续 foliate-js 遵循同一事件边界 | EmbedPDF / foliate-js | 不含业务逻辑、不落盘 |
| **Features/annotations** | 批注增改删编排、统一批注模型转换、undo/redo 栈、锚点失效重定位 | Engines、Data 层、fileData store | 不直接调引擎私有 API |
| **Features/bookmarks** | 书签增删改、命名排序、跳转定位 | Engines、Data 层 | — |
| **Features/search** | 文档内搜索编排：防抖输入、命中导航 | Engines | 不做跨文件搜索（非目标） |
| **Features/tts** | TTS 状态机（朗读/暂停/继续/停止）、句级高亮控制 | Engines(EPUB) | 仅 EPUB 启用 |
| **Features/library** | 索引合并、pageCount 懒提取调度、文件丢失重定位逻辑 | Workers、library store、window.lec.library | 不扫描（扫描在主进程） |
| **Data 访问层** | sidecar 读写编排：500ms 防抖、原子写调用、schema 迁移、导入重映射 | window.lec.data、stores | 不含 UI |
| **Stores** | 内存态唯一数据源（tabs/library/settings/fileData/ui） | Data 层 | 不触磁盘 |
| **Workers** | PDF 页数提取、EPUB 解压解析（重活隔离） | — | 不持有 UI 状态 |
| **i18n / theme** | 中英文案资源；antd token 与浅/深主题派生 | settings store | — |

---

## 4. 模块间数据流转

> 约定：实线箭头 = 调用/写入；虚线箭头 = 事件订阅。图中编号 ①–⑧ 对应下方流转说明与流程图。

### 4.0 流程图总览（泳道）

```
 用户/系统          主进程                    渲染进程(UI)            渲染进程(数据/引擎)       磁盘
──────┬───────────────┼──────────────────────────┼──────────────────────┼──────────────────┼────
 双击 │  SingleInstance│                          │                      │                  │
 文件 │───────► 路由 path ───────────────────────►│ Shell 收到路径        │                  │
      │  ProtocolSvc   │                          │  建标签              │                  │
      │  lec-file://◄──┼──────────────────────────┼──────────────────────┤ 引擎拉取(流式)   │
      │                │                          │                      │                  │
 批注 │                │                          │ 用户在视口操作 ─────►│ 引擎原生锚点      │
 操作 │                │                          │                      │ UnifiedAnnotation │
      │                │                          │                      │ 500ms 防抖 ──────►│ data/<h>.json
      │                │                          │                      │                  │
 设置 │                │                          │ Settings 页 ────────►│ 防抖写 ──────────►│ config.json
 变更 │                │                          │                      │                  │
 扫描 │                │ LibrarySvc ◄─────────────┤ 添加文件夹           │                  │
      │                │───────► 元数据列表 ──────►│ 合并索引             │                  │
 定时 │                │ BackupSvc ───────────────┼──────────────────────┼──────────────────┼──► backups/
──────┴────────────────┴──────────────────────────┴──────────────────────┴──────────────────┴────
```

### 4.1 打开文件（编号 ①）

```
              ┌─────────────────────────────┐
              │ 双击文件关联 / 拖放 / 命令行 │
              └──────────────┬──────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ SingleInstance 单实例判定    │
              └───────┬─────────────┬───────┘
            首启(创建窗口)        已运行
              │                     │
              ▼                     ▼
    ┌──────────────────┐   ┌──────────────────────┐
    │ 窗口就绪后下发路径 │   │ 焦点窗口 + 下发路径    │
    └────────┬─────────┘   └──────────┬───────────┘
             └────────────┬───────────┘
                          ▼
             ┌────────────────────────────┐
             │ Shell 收到路径 → 建标签     │
             └────────────┬───────────────┘
                          ▼
             ┌────────────────────────────┐     不存在
             │ window.lec.fs.stat 校验存在 ├──────────────┐
             └────────────┬───────────────┘              │
                     存在 │                              ▼
                          ▼                ┌────────────────────────────┐
             ┌────────────────────────────┐│ "文件已移动" → 重定位流程  │
             │ Engines.open()              ││ (locateMissingFile 对话框) │
             │  ├─ PDF: lec-file:// 流式   │└────────────┬───────────────┘
             │  ├─ EPUB: readBuffer 整包   │             │ 用户重新选择后回到 stat
             │  └─ 加密: 回调密码框(会话缓存)│             │
             └────────────┬───────────────┘             │
                          ▼                             │
             ┌────────────────────────────┐             │
             │ 读 sidecar → fileData store │◄────────────┘
             │ 恢复 progress / 批注渲染    │
             └────────────┬───────────────┘
                          ▼
             ┌────────────────────────────┐
             │ 写 library.recent + progress│──► library.json（防抖）
             └────────────────────────────┘
```

### 4.2 批注写入（编号 ②）

```
 ┌───────────────────┐
 │ 用户在视口划选/落笔 │
 └─────────┬─────────┘
           ▼
 ┌───────────────────────────┐
 │ Engines.annotations.apply │──► 引擎原生锚点(坐标/CFI)
 └─────────┬─────────────────┘
           ▼
 ┌───────────────────────────────┐
 │ Features/annotations          │
 │ serialize → UnifiedAnnotation │
 └─────────┬─────────────────────┘
           ▼
 ┌───────────────────────────────┐
 │ fileData store 更新            │
 │ (同时入 undo/redo 栈 ≤50 步)   │
 └─────────┬─────────────────────┘
           ▼
 ┌───────────────────────────────┐
 │ Data 层 500ms 防抖合并          │
 └─────────┬─────────────────────┘
           ▼
 ┌───────────────────────────────┐
 │ window.lec.data.writeJson     │──► DataStoreSvc 原子写(tmp+rename)
 └───────────────────────────────┘     └──► data/<hash>.json
```

### 4.3 设置变更（编号 ③）

```
 ┌────────────────────┐
 │ Settings 页修改一项 │
 └─────────┬──────────┘
           ▼
 ┌─────────────────────────────────┐
 │ settings store 即时生效          │
 │ ├─ theme → antd tokens → 全局UI │
 │ ├─ 语言 → i18n 热切换            │
 │ └─ 快捷键 → Shell 重新注册分发   │
 └─────────┬───────────────────────┘
           ▼
 ┌──────────────────────┐
 │ Data 层防抖 → config.json │
 └──────────────────────┘
```

### 4.4 目录扫描与索引（编号 ④）

```
 ┌────────────────────────┐
 │ Settings "添加文件夹"    │
 └──────────┬─────────────┘
            ▼
 ┌──────────────────────────────┐
 │ window.lec.library.scanFolders│
 └──────────┬───────────────────┘
            ▼  (主进程 LibrarySvc: readdir+stat, 不解析内容)
 ┌──────────────────────────────┐
 │ 返回 FileIndexEntry[] 元数据  │
 └──────────┬───────────────────┘
            ▼
 ┌──────────────────────────────┐
 │ Features/library 合并进 store │
 │ (pageCount=null 懒提取)       │
 └──────────┬───────────────────┘
            ▼
 ┌──────────────────────────────┐
 │ 防抖写 library.json           │
 └──────────────────────────────┘

 首次打开文件 ──► Workers 提取 pageCount ──► 回填 store ──► library.json
```

### 4.5 自动备份（编号 ⑤）

```
 ┌──────────────────────────────┐
 │ BackupSvc 定时器(默认每周)触发 │
 └──────────┬───────────────────┘
            ▼
 ┌──────────────────────────────┐
 │ 打包 library.json + 全部      │
 │ data/*.json → export.zip     │
 └──────────┬───────────────────┘
            ▼
 ┌──────────────────────────────┐
 │ backups/backup-<ts>.zip      │
 │ 轮转保留最近 3 份(删除最旧)    │
 └──────────────────────────────┘

 手动导出: Settings ──► exportData(用户选位置) ──► 同格式 zip
 手动导入: importData(src) ──► 解包按 path 重映射 ──► 缺失文件跳过并报告
```

### 4.6 崩溃恢复（编号 ⑥）

```
 ┌─────────────┐
 │  应用启动    │
 └──────┬──────┘
        ▼
 ┌──────────────────────────┐
 │ CrashMarker 读 runtime.json│
 └──────┬───────────┬───────┘
 cleanExit=true   cleanExit=false
        │              │
        ▼              ▼
 ┌────────────┐  ┌─────────────────────────┐
 │ 静默进开始页 │  │ Shell 弹"恢复上次打开的   │
 └────────────┘  │ 文档?" 确认框             │
                 └───────┬──────────┬──────┘
                     取消│          │确认
                         ▼          ▼
                  ┌─────────┐  ┌─────────────────────┐
                  │ 进开始页 │  │ 按 lastTabPaths 逐一  │
                  └─────────┘  │ 走 4.1 打开流程(自带  │
                               │ 进度恢复)             │
                               └─────────────────────┘

 正常退出(窗口全关) ──► CrashMarker 置 cleanExit=true ──► runtime.json
```

### 4.7 更新检查（编号 ⑦）

```
 ┌────────────────────────────┐
 │ 帮助菜单 / 设置页 "检查更新" │
 └──────────┬─────────────────┘
            ▼
 ┌────────────────────────────┐
 │ window.lec.update.checkForUpdates
 └──────────┬─────────────────┘
            ▼  (主进程 UpdateSvc: electron-updater)
 ┌──────────┬─────────────────┐
 │   有新版 │        无新版    │
 ▼          ▼                 │
 ┌──────────────────┐  ┌──────────────┐
 │ UI 提示弹窗(版本/  │  │ 提示"已是最新" │
 │ 更新说明)          │  └──────────────┘
 └────────┬─────────┘
          ▼
 ┌──────────────────┐
 │ 用户点下载(跳官网/ │──► 手动安装(不静默)
 │ 下载链接)          │
 └──────────────────┘
```

### 4.8 文件删除（编号 ⑧）

```
 ┌──────────────────────────────┐
 │ StartPage 右键"删除文件"      │
 └──────────┬───────────────────┘
            ▼
 ┌──────────────────────────────┐
 │ 确认框: "删除后可在回收站找回" │
 └──────┬──────────────┬────────┘
    取消│              │确认
        ▼              ▼
  ┌──────────┐  ┌──────────────────────────────┐
  │ 不动作    │  │ window.lec.fs.trashItem(path) │
  └──────────┘  │ (系统回收站)                  │
                └──────────┬───────────────────┘
                           ▼
                ┌──────────────────────────────┐
                │ Features/library 移除索引     │
                └──────────┬───────────────────┘
                           ▼
                ┌──────────────────────────────┐
                │ library store → library.json  │
                └──────────────────────────────┘

 "移出库"入口: 跳过 trashItem，仅删索引条目，磁盘文件不动
```

---

## 5. 引擎适配层（跨格式演进契约）

```ts
// 未来跨格式能力收敛时的目标契约；当前 PDF 已先以更小的控制器接口落地。
interface ReaderEngine {
  kind: 'pdf' | 'epub';
  open(source: FileSource): Promise<DocMeta>;      // 加密 PDF 在此回调 password()
  close(): void;
  layout: { setMode(m: LayoutMode): void };        // 单页/连续/双页
  view: {
    zoom(z: number): void;                          // 10%–400%
    rotate(deg: 0|90|180|270): void;                // 视图级，不持久化
    goto(loc: LocationRef): void;                   // 页码 / 章节 / CFI
    getPosition(): LocationRef;                     // 进度恢复
    setNightMode(on: boolean): void;                // PDF 反色
  };
  outline(): OutlineNode[];                         // 目录（含当前位置高亮）
  thumbs?: { count(): number; renderPage(i): Blob }; // PDF 缩略图（懒加载）
  search(q: string, opts): SearchHit[];             // 文档内搜索
  selection: {
    onSelect(cb: (sel: SelectionRef) => void);
    getText(sel): string;                           // 复制文本
  };
  annotations: {
    apply(a: AnnotationDraft): EngineAnchor;
    list(): EngineAnnotation[];
    update(id, patch): void; remove(id): void;
    serialize(a): UnifiedAnnotation;                // 引擎格式 ↔ 统一模型
  };
  tts?: TtsController;                              // 仅 EPUB
  applySettings?: (s: EpubSettings) => void;        // 仅 EPUB
}
```

**要点**
- PDF 适配器收敛全部 EmbedPDF 插件（搜索、缩略图、目录、页码与视图控制）；后续 EPUB 适配器同样收敛 foliate-js 能力。引擎差异被封死在 `src/data/readers/`。
- 打开通道：PDF 走 `lec-file://` 流式（200MB 不炸内存）；EPUB 走 `readBuffer` 整包 ArrayBuffer。
- 加密 PDF：`open()` 检测密码需求 → 回调 UI 弹框 → 会话内缓存（不落盘）。

---

## 6. 数据结构（磁盘 schema）

所有磁盘文件位于 `userData/`（Windows `%APPDATA%/LecPDF/`），全部带 `version` 字段，读时做迁移。**文件身份主键 = 规范化绝对路径**；sidecar 文件名 = `md5(path).slice(0,16)`。

```
userData/
├─ config.json          应用设置
├─ library.json         索引/最近/星标/目录
├─ runtime.json         启动标记（崩溃恢复）
├─ data/<pathHash>.json 每文件 sidecar（批注/书签/位置/EPUB设置）
├─ cache/               渲染缓存（2GB LRU）
├─ backups/             backup-<ts>.zip ×3
└─ logs/
```

### 6.1 `config.json`

```json
{
  "version": 1,
  "language": "zh-CN",
  "appearance": { "theme": "light | dark | system" },
  "reading": {
    "defaultZoom": 100, "defaultLayout": "continuous",
    "pdfNightMode": false, "pageAnimation": true
  },
  "annotation": { "defaultColors": {
    "highlight": "#fff1a8", "underline": "#1677ff",
    "strikeout": "#f5222d", "squiggly": "#722ed1",
    "note": "#faad14", "freetext": "#1677ff", "ink": "#fa8c16"
  }},
  "shortcuts": { "open": "Ctrl+O", "closeTab": "Ctrl+W", "search": "Ctrl+F",
    "highlight": "H", "underline": "U", "strikeout": "D", "squiggly": "W",
    "note": "N", "ink": "P", "fullscreen": "F11", "print": "Ctrl+P",
    "undo": "Ctrl+Z", "redo": "Ctrl+Y",
    "zoomIn": "Ctrl+=", "zoomOut": "Ctrl+-", "zoomReset": "Ctrl+0" },
  "general": {
    "launchAtStartup": false,
    "autoBackup": { "enabled": true, "intervalDays": 7, "keep": 3 }
  },
  "window": { "bounds": {"x":0,"y":0,"width":1280,"height":800}, "maximized": false }
}
```

### 6.2 `library.json`

```json
{
  "version": 1,
  "recent": [   // ≤100，LRU
    { "path": "C:\\docs\\paper.pdf", "openedAt": 1787795814,
      "progress": { "page": 8, "chapter": null, "percent": 0.33 } }
  ],
  "starred": ["C:\\docs\\paper.pdf"],
  "folders": ["C:\\Users\\me\\Documents"],
  "files": {
    "C:\\docs\\paper.pdf": {
      "kind": "pdf", "name": "paper.pdf",
      "size": 5242880, "mtime": 1787795814,
      "addedAt": 1787795814, "pageCount": null,   // 懒提取
      "missing": false                              // 路径失效标记
    }
  }
}
```

### 6.3 `data/<hash>.json`（sidecar，双引擎统一模型）

```json
{
  "version": 1,
  "path": "C:\\docs\\paper.pdf",
  "kind": "pdf",
  "book": {
    "progress": { "page": 8, "epubCfi": null, "scrollTop": 0, "percent": 0.33,
                  "zoom": 100, "layout": "continuous", "updatedAt": 1787795814 }
  },
  "annotations": [
    {
      "id": "a-01HX...",
      "type": "highlight | underline | strikeout | squiggly | note | freetext | ink",
      "loc": { "page": 8, "epubCfi": null },        // 定位锚点（互斥填写）
      "quote": "Interfacial resistance arises...",   // 文本摘录（检索/回找）
      "rects": [ { "x": 0.12, "y": 0.34, "w": 0.6, "h": 0.02 } ], // 归一化矩形
      "color": "#fff1a8",
      "body": "我的笔记",              // note/freetext 内容
      "ink": [ [ {"x":0.1,"y":0.2}, {"x":0.2,"y":0.3} ] ],
      "createdAt": 1787795814, "updatedAt": 1787795814
    }
  ],
  "bookmarks": [
    { "id": "b-01HX...", "name": "重点结论", "loc": { "page": 8, "epubCfi": null },
      "createdAt": 1787795814 }
  ],
  "epubSettings": { "fontSize": 17, "lineHeight": 1.8, "margin": 5,
                    "theme": "light | sepia | dark" },     // 仅 EPUB
  "tts": { "rate": 1.0, "voice": null, "lang": "zh-CN" }   // 仅 EPUB
}
```

**统一批注模型说明**
- `loc`：PDF 用 `page`；EPUB 用 `epubCfi`。二者互斥填写。
- `rects` 归一化（0–1 相对页面），PDF 侧由适配器与引擎坐标互转；EPUB 无矩形，锚定靠 CFI + `quote` 文本回找。
- `quote` 双用途：聚合视图展示摘录、锚点失效时的文本回找降级。
- **锚点失效策略**：文件更新后页码/CFI 漂移 → 先按 `quote` 全文检索重定位 → 失败则标"批注位置已失效"，不删除数据。

### 6.4 `runtime.json`（崩溃恢复）

```json
{ "cleanExit": false, "lastTabPaths": ["C:\\docs\\paper.pdf"], "startedAt": 1787795814 }
```
启动时 `cleanExit=false` → 弹恢复提示；正常退出置 `true`。

### 6.5 导出/备份包格式

```
export.zip
├─ manifest.json   { "app": "LecPDF", "version": 1, "exportedAt": ... }
├─ library.json
├─ config.json（可选，导入时合并询问）
└─ data/<hash>.json ×N（含 path 字段 → 导入时按路径重映射）
```
自动备份同格式写入 `backups/`，保留最近 3 份。

---

## 7. 渲染层状态（zustand stores）

| store | 内容 | 持久化 |
|---|---|---|
| `tabs` | 标签列表（{id, path, kind, engineRef, title}）、activeTabId、上限 20 | 否（崩溃恢复走 runtime.json） |
| `library` | recent/starred/folders/files 的内存投影 | library.json（防抖写） |
| `settings` | config.json 全量 + antd 主题 token 派生 | config.json |
| `fileData` | 当前打开文件的 sidecar 投影（annotations/bookmarks/progress…） | sidecar 实时防抖写 |
| `ui` | 侧栏开关、当前工具、搜索栏、夜间模式等会话态 | 否 |

**undo/redo**：`fileData` 内每文件维护操作栈（≤50 步，仅批注增/改/删），操作对象 `{do, undo}` 闭包，会话级不落盘。

---

## 8. 性能设计

| 点 | 方案 |
|---|---|
| 大 PDF 打开 | `lec-file://` 协议流式 + embedpdf 虚拟滚动（原生能力） |
| 缩略图 | 懒加载：进入视口才渲染，LRU 位图缓存 |
| 批注渲染 | 引擎原生批注层（不在 DOM 自绘）；风险 3 类先做验证 |
| 搜索 | 引擎原生（EmbedPDF 文本层 / foliate-js 全文），UI 侧防抖输入 |
| 页面提取 | worker 线程做 PDF 页数提取，不阻塞主线程 |
| 磁盘缓存 | cache/ 2GB LRU，设置页可视化清理 |
| 内存 | 非活动标签释放渲染位图；标签数超 20 阻止再开；>200MB 走轻量模式 |

---

## 9. 目录结构

```
lecpdf/
├─ electron/                 # 主进程（TS）
│  ├─ main.ts
│  ├─ services/              # 与 §3.1 模块一一对应
│  │  ├─ windowManager.ts / singleInstance.ts / protocol.ts
│  │  ├─ library.ts / dataStore.ts / backup.ts / update.ts / crashMarker.ts
│  └─ logger.ts
├─ preload.ts                # contextBridge → window.lec（唯一 IPC 通道）
├─ shared/                   # 主/渲染共享类型与 schema（§6 结构）
├─ src/                      # 渲染进程（React + antd）
│  ├─ shell/                 # 标题栏 / 标签页 / 应用菜单 / 窗口三键 / 快捷键
│  ├─ pages/                 # startPage / reader / settings
│  ├─ data/readers/          # pdf/（EmbedPDF）与 foliate/（foliate-js）适配器
│  ├─ features/              # annotations / bookmarks / search / tts / library
│  ├─ data/                  # sidecar 访问层（防抖写/undo/migrate/重定位）
│  ├─ stores/                # zustand（§7）
│  ├─ workers/               # 页数提取 / EPUB 解析
│  ├─ i18n/  theme/
│  └─ App.tsx
├─ electron-builder.yml      # NSIS + fileAssociations(.pdf/.epub)
└─ package.json
```

---

## 10. 风险对应设计

| 风险（FRD §2.3） | 架构对策 |
|---|---|
| 下划线/删除线/波浪线 | 适配器内探测 embedpdf 能力：支持→原生；不支持→以 highlight 自绘外观降级（rects 相同、type 不同） |
| PDF 智能反色 | 引擎支持分层→文字层滤镜；不支持→整体 CSS 反色 + 图片二次反色兜底 |
| EPUB 选区锚定 | CFI 主锚 + quote 文本回找双保险（§6.3） |
| TTS 句级高亮 | foliate-js 适配器内做 DOM 分句映射；不可行则降级为段落级高亮 |

---

## 11. 已确认项（2026-08-27）

| # | 项 | 决定 |
|---|---|---|
| A1 | 渲染框架 | React 18 + TS |
| A2 | 状态管理 | Zustand |
| A3 | embedpdf 分支 | v2 稳定分支 |
| A4 | 包管理/构建 | pnpm + electron-vite |
| A5 | sidecar 主键 | 路径哈希（`md5(path)`）——文件移动后靠 path 字段重连 |

---

## 12. 下一步（待你发令）

1. **项目脚手架 + 双引擎骨架**（可运行的壳）
2. 或先写**接口定义代码**（shared 类型 + ReaderEngine 接口 + IPC 契约）作为开发基准
