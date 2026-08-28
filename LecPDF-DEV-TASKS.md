# LecPDF 开发任务拆分文档

> 版本：v2.0（执行路径优化）· 日期：2026-08-28
> 上游依据：`LecPDF-FRD.md`（40 项决策）、`LecPDF-ARCHITECTURE.md`（v2.1 模块架构）、墨刀原型（在线分享 6a7eb60375d0275ef6d467d3 + 离线导出包）
> 说明：本文定义里程碑、依赖和风险门禁；`LecPDF-ISSUES.md` 是唯一可领取、可完成的执行单元。附录 A 为原型提取的设计风格规范，开发 UI 时以此为准。

## 执行规则（v2.0，优先于下文旧的里程碑说明）

1. **按需验证、再交付风险能力**：PDF 批注/打印、PDF 智能反色、EPUB 锚定、EPUB TTS 均为产品风险。M0/M1/M3 与基础阅读可先行；仅在开始对应风险功能前，执行相应 R0 并写入可复现证据和 `原生支持 / 应用层扩展 / 需要 fork / 开源不可行` 判定。
2. **单一执行真相源**：本文保留为架构级路线图；每次开发只按 `LecPDF-ISSUES.md` 的一个 Issue 工作。任务完成必须同时满足代码、自动化验证和该 Issue 的验收项。
3. **纵向切片优先**：一个 Issue 从 IPC/状态/界面到可观察结果形成闭环；不得将“页面骨架”作为替代引擎可用性的完成标准。
4. **能力可选而非静默降级**：R0 若判定 `应用层扩展` 或 `需要 fork`，后续 Issue 必须采用对应路线；若判定 `开源不可行`，阻塞该能力并请求产品决策，不交付假功能。
5. **质量门禁前置**：M0 建立 fixtures、单元测试、Electron 冒烟和 CI；后续每项以新增或更新回归测试为完成条件。性能与人工可视检查留在 HITL 门禁，不伪装成 AFK 完成。

## 优化后的交付路径

```
M0 工程骨架与数据契约  →  M1 主进程服务、M3 Shell/状态、PDF 基础阅读（可并行）
                                              ↓
  需要风险能力时：R0-02 批注/打印 · R0-03 夜间模式 · R0-04 EPUB 批注 · R0-05 TTS
                                              ↓
                       M4 纵向功能切片（开始页、PDF、EPUB、设置、打印）
                                              ↓
                                  M5 安装、性能、稳定性、发布审计
```

### 依赖调整清单

| 原任务 | 优化后的规则 | 原因 |
|---|---|---|
| T2.3 / LEC-020 | 必须在 R0-02 有非阻塞 verdict 后开始 | 七类批注与打印不是可假设的引擎能力 |
| T2.4 / LEC-021 | 必须在 R0-03 后开始 | 不能承诺“图片保真”的 CSS 兜底 |
| T2.6 / LEC-024 | 必须在 R0-04 后开始 | 锚点恢复必须以 CFI/回找实证为准 |
| T2.7 / LEC-025 | 必须在 R0-05 后开始 | 句级高亮不可用时须由 verdict 决定产品行为 |
| T4.4 / LEC-037 | PDF 与 EPUB 搜索分别验收、分别可交付 | 避免一个引擎阻塞另一个格式 |
| T4.5 / LEC-038 | PDF 书签与 EPUB 书签分别依赖各自引擎，不等待 EPUB 批注 | 书签不依赖 EPUB 选区批注 |
| T4.6 / LEC-039 | 不再依赖 PDF 阅读器页面；只复用 Shell 和共享 ReaderChrome | PDF/EPUB 两条产品线可并行 |
| T4.1 / LEC-034 | 聚合视图在书签与批注数据源均可用后交付 | 不让开始页骨架背负尚未实现的跨文件功能 |
| T4.8 / LEC-041 | 依赖 R0-02 的打印路线，不以画布可见作为通过 | 保证外部查看器中的可打印性 |

### 任务粒度原则

- 本文原 T4.1、T4.4、T4.5、T4.6 的大任务不再被视作可直接领取项；实施时按 Issue 中的“骨架/数据源/交互/聚合”纵向切片完成。
- 一个 Issue 只允许有一个主验收体验和一个可回归验证命令；若同时要求 PDF 与 EPUB 两套实现，必须分别列出验收记录。
- 每个风险 Issue 都必须链接 `spikes/results/` 的 JSON、截图或人工矩阵记录；没有证据即未完成。

---

## 附录 A：设计风格与视觉规范（源自墨刀原型）

> 设计体系：**Ant Design 5 组件 + 原型视觉风格**（FRD 决策 #8）。以下规范从原型 HTML（LecPDF 桌面阅读器）逐项提取，开发时以本规范为准，antd 主题 token 在 M0 落地。

### A.1 色彩

| Token | 值 | 用途 |
|---|---|---|
| 窗口底色 | `#e8edf4` | 应用主背景（`colorBgLayout`） |
| 页面渐变底 | `radial-gradient(circle at 50% -20%, #f8fbff 0%, #e9eff7 42%, #dfe7f2 100%)` | 开始页/空态背景 |
| 标题栏/工具栏底 | `#f8fafc` @95% + `backdrop-blur` | 顶栏半透明模糊 |
| 侧栏底 | 渐变 `#f9fbfe → #f2f6fb` | 左右侧栏 |
| 主色 | `#1677ff`（blue-600） | 按钮/激活态/焦点环（antd `colorPrimary`） |
| Logo 渐变 | `linear-gradient(135deg, #3b82f6, #4f46e5)`（blue-500→indigo-600） | 标题栏 Logo 方块 |
| 主文字 | `#1e293b`（slate-800） | 正文/标题（`colorText`） |
| 次文字 | `#64748b`（slate-500） | 说明/未激活标签 |
| 弱文字 | `#94a3b8`（slate-400） | 占位符/水印 |
| 边框 | `#e2e8f0`（slate-200）；强边框 `#cbd5e1`（slate-300） | 分割线/输入框（`colorBorder`） |
| 悬停底 | `#f1f5f9`（slate-100）；蓝色悬停 `#eaf3ff` | 按钮/菜单 hover |
| 激活底 | `#dbeafe`（blue-100）+ 文字 `#1d4ed8`（blue-700） | 工具选中态 |
| 高亮批注 | `#fff1a8`（amber-100） | 默认高亮色 |
| 批注强调 | `#f59e0b`（amber-500）/ `#f5222d`（red）/ `#722ed1`（purple） | 批注色板 |
| 危险 | `#ef4444`（red-500） | 关闭按钮 hover、删除 |
| 遮罩 | `rgba(15,23,42,.3)`（`#0f172a`@30%） | 弹窗遮罩 |
| 阴影 | `0 16px 36px rgba(15,23,42,.16)`；`0 24px 64px rgba(15,23,42,.22)`；`0 18px 48px rgba(15,23,42,.16)` | 弹层/文档纸面投影 |

### A.2 字体与字号

- 字体：`font-sans` 系统栈（antd 默认字体）；中文优先 PingFang SC / Microsoft YaHei
- 标题栏 App 名：**15px / bold / tracking-tight**
- 工具栏按钮文字：**12px**（`text-xs`）
- 侧栏列表：**14px**（`text-sm`）
- 菜单项：**12px**
- 弹窗标题：**14px bold**；说明文字 **12px**
- 标签页标题：**12px**，激活加 `font-semibold`

### A.3 布局尺寸

| 区域 | 尺寸 |
|---|---|
| 窗口最小宽度 | 1080px |
| 标题栏 | 高 56px（h-14），内含标签页 |
| 标签页 | 高 40px（h-10），最小宽 128px、最大 210px，圆角 `rounded-t-xl` |
| 工具栏 | 高 48px（h-12） |
| 侧栏 | 宽 256px（w-64） |
| 图标按钮 | 32×32（h-8 w-8），图标 18–19px（iconify `solar:` 图标集） |
| 窗口控制钮 | 40×44（h-10 w-11） |
| 主按钮 | 高 40px（h-10）`rounded-md` |
| 输入框 | 高 32px（h-8）`rounded` |
| 弹窗面板 | 宽 420px，`rounded-xl`，内边距 20px |
| PDF 页面纸宽 | 680px 居中，白底投影 |

### A.4 组件样式要点

- **标题栏**：`bg-[#f8fafc]/95 backdrop-blur-xl`，底边 `border-b border-slate-200`；窗口三键：最小化/最大化 `hover:bg-slate-200`，关闭 `hover:bg-red-500 hover:text-white`
- **标签页**：激活态 `bg-white + border-slate-200 + 上提阴影`；未激活 `bg-transparent border-transparent text-slate-500 hover:bg-slate-200/70`；带图标（首页=blue-50 底蓝图标，PDF=red-50 底红 `PDF` 徽标）；关闭钮 `hover:text-slate-700`
- **工具栏图标按钮**：默认 `text-slate-600 hover:bg-slate-100`；激活态 `bg-blue-100 text-blue-700`；批注工具激活 `bg-amber-100 text-amber-600`；尺寸 32×32
- **主按钮**：`bg-blue-600 text-white hover:bg-blue-700`；次按钮 `border border-slate-300 bg-white text-blue-700 hover:bg-blue-50`
- **焦点环**：`0 0 0 3px rgba(22,119,255,.18)`（antd 默认即可）
- **输入框**：`rounded border border-slate-300`，聚焦 `border-blue-500`；搜索框带放大镜图标
- **侧栏**：渐变底 + 白 72% 半透明分组头；导航项激活 `bg-blue-100 font-semibold text-blue-700`
- **弹窗**：遮罩 `bg-slate-900/30` 居中；面板 `rounded-xl bg-white shadow-2xl`；标题+说明+关闭钮（`hover:bg-slate-100`）；底部按钮右对齐（取消 `hover:bg-slate-100` / 主操作 `bg-blue-600`）
- **滑杆**：`accent-color: #1677ff`（阅读设置字体/行距/页边距）
- **主题按钮**：浅色 `bg-white`、暖黄 `bg-[#eee4c9]`、深色 `bg-slate-700 text-white`
- **状态栏**：底部细条，显示操作反馈文案（如"已启用高亮工具"）

### A.5 动效

- 全部过渡 **160ms ease**（`transition: ... .16s ease`）
- 图标按钮 hover：`translateY(-1px)`；侧栏导航项 hover：`translateX(2px)`；开始页卡片 hover：`translateX(3px) + 阴影加深`
- 标签切换即时（无动画）

### A.6 antd 主题映射（M0 落地）

```ts
// theme.ts 摘要
{
  token: {
    colorPrimary: '#1677ff',
    colorBgLayout: '#e8edf4',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    colorBorder: '#e2e8f0',
    borderRadius: 8,
    fontSize: 14,
  },
}
```

- 标题栏/标签页/工具栏因高度自定义（56/40/48px）需 CSS 覆盖 antd 默认；
- 图标统一 iconify `solar:` 系列（与原型一致），antd 图标仅用于表单类场景。

---

## 任务总览

| 里程碑 | 主题 | 执行单位 | 依赖 |
|---|---|---|---|
| R0 | 按需风险验证与可复现测试基线 | 5 个验证 Issue | 对应风险功能开始前 |
| M0 | 工程骨架、共享契约与测试基础 | 6 个 Issue | — |
| M1 | 主进程系统面 | 9 个 Issue | M0 |
| M2 | 双引擎能力 | 10 个 Issue | M0 + 对应 R0 verdict |
| M3 | 渲染层核心 | 5 个 Issue | M0、M1 |
| M4 | 页面与功能纵向切片 | 12 个 Issue | M2、M3 |
| M5 | 集成与交付 | 4 个 Issue | M4 |

依赖图（简化）：

```
M0(T0.1→T0.2→T0.3)
  ├── M1(T1.1~T1.6，仅依赖 M0 全部)
  ├── M2(T2.1 依赖 T0.2；T2.2~T2.7 依赖 T2.1)
  └── M3(T3.1→T3.2→T3.3；T3.4 独立，依赖 M0)
        └── M4(见各任务依赖)
              └── M5
```

---

## M0 基础骨架

### T0.1 项目脚手架与安全壳

- **目标**：可运行的空 LecPDF 桌面应用。
- **内容**：
  - pnpm + electron-vite + React 18 + TypeScript + Ant Design 5 + Zustand，精确锁定版本（含 embedpdf 2.15.0 / epubjs 0.3.93 / electron 44 相关依赖）
  - Electron 安全基线：`contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`；preload 为单文件 CJS（Electron ESM 兼容）
  - 主进程入口 `main.ts`、`preload.ts`、渲染入口 `App.tsx` 骨架；空 frameless 窗口可启动
  - antd 主题 token 落地（附录 A.6：`colorPrimary #1677ff` / `colorBgLayout #e8edf4` / `colorText #1e293b` / `borderRadius 8`）+ 设计规范文档引用（附录 A）
- **依赖**：无
- **验收**：`pnpm dev` 启动出空窗口；`pnpm build` exit 0；tsc 干净；主题 token 生效
- **参考**：ARCH §1 技术选型、§9 目录结构、附录 A

### T0.2 shared 类型与 IPC 契约

- **目标**：主/渲染共享的类型与 IPC 接口定义，作为全部后续任务的编译期契约。
- **内容**：
  - `shared/` 下落地磁盘 schema 类型：`Config`、`Library`、`Sidecar`（`UnifiedAnnotation` 判别联合 7 类）、`RuntimeMark`、`BackupManifest`（对应 ARCH §6.1–6.5）
  - `shared/ipc.ts`：`window.lec` 全量接口（window/dialogs/fs/library/fileRead/data/backup/update/lifecycle，ARCH §3 IPC 表）
  - 渲染侧 `env.d.ts` 声明 `window.lec`
- **依赖**：T0.1
- **验收**：类型文件编译通过；tsc 干净
- **参考**：ARCH §3、§6

### T0.3 DataStoreSvc 与 schema 迁移框架

- **目标**：磁盘 JSON 原子读写服务 + 版本迁移机制。
- **内容**：
  - 主进程 `dataStore.ts`：`readJson/writeJson`（临时文件 + rename 原子写、读写互斥），统一 userData 路径解析
  - schema 迁移器：按 `version` 字段逐版本迁移；遇未知高版本进入只读保护（拒绝覆盖）
  - 单元测试：原子写失败清理、损坏 JSON 处理、迁移链
- **依赖**：T0.2
- **验收**：vitest 覆盖原子写/迁移/损坏文件用例 PASS
- **参考**：ARCH §3.1 DataStoreSvc、§6

---

## M1 主进程系统面

### T1.1 WindowManager 与窗口几何

- **目标**：frameless 窗口管理 + 三键控制 + 几何记忆。
- **内容**：`windowManager.ts`：frameless 窗口创建；`window.minimize/maximize/close`、`onMaximizedChange` IPC；关闭时保存 bounds/maximized 到 config，启动还原，越界回退主屏中央
- **依赖**：T0.3
- **验收**：窗口三键可用；重启后位置/最大化状态还原；拔掉外接显示器后启动不越界
- **参考**：FRD §4.2、ARCH 流程图 4.x、§3.1

### T1.2 SingleInstance 与 ProtocolSvc

- **目标**：单实例锁 + 文件参数路由 + PDF 流式读取协议。
- **内容**：
  - `singleInstance.ts`：二次启动捕获命令行文件路径 → `lifecycle.onOpenFileRequest` 下发到已开窗口
  - `protocol.ts`：注册 `lec-file://` 协议，按 Range 流式读取本地 PDF（支持大文件）
- **依赖**：T0.3、T1.1
- **验收**：双开应用时第二个实例退出且文件在首个窗口路由成功；`lec-file://` 可流式读取 200MB 测试 PDF
- **参考**：FRD §4.9、ARCH §3.1、流程图 4.1

### T1.3 LibrarySvc 目录扫描

- **目标**：文件库目录扫描（主进程侧）。
- **内容**：`library.ts`：`scanFolders(paths[])` → `FileIndexEntry[]`（readdir+stat，不解析内容；过滤 .pdf/.epub）
- **依赖**：T0.3
- **验收**：扫描含 PDF/EPUB/其他文件的目录，返回正确的元数据列表
- **参考**：FRD §4.1.5、ARCH 流程图 4.4

### T1.4 CrashMarker 崩溃标记

- **目标**：异常退出检测。
- **内容**：`crashMarker.ts`：启动写 `runtime.json`（cleanExit=false + lastTabPaths + startedAt）；正常退出置 true；提供 lastTabPaths 给恢复提示
- **依赖**：T0.3
- **验收**：强杀进程后重启检测到 cleanExit=false；正常退出后为 true
- **参考**：FRD §4.9、ARCH §6.4、流程图 4.6

### T1.5 BackupSvc 备份/导出/导入

- **目标**：自动备份与数据迁移。
- **内容**：`backup.ts`：定时备份（默认每周，轮转保留 3 份，ARCH §6.5 包格式）；手动导出（用户选位置）；导入（解包按 path 重映射，缺失文件跳过并报告）
- **依赖**：T0.3
- **验收**：定时触发产出 `backups/backup-<ts>.zip`；导入后批注/书签/进度按路径还原
- **参考**：FRD §4.8、ARCH 流程图 4.5

### T1.6 UpdateSvc 与 Logger

- **目标**：更新检查 + 本地日志。
- **内容**：`update.ts`（electron-updater 检查，返回版本信息，不静默安装）；`logger.ts`（electron-log 落盘 logs/；零遥测，不发送任何数据）
- **依赖**：T0.3
- **验收**：检查更新返回版本；日志文件落盘；无外发网络请求
- **参考**：FRD §4.9/#32、ARCH §3.1

---

## M2 引擎适配层

### T2.1 ReaderEngine 统一接口定义

- **目标**：双引擎统一契约（编译期基座）。
- **内容**：`engines/types.ts`：`ReaderEngine` 接口（ARCH §5）+ `LocationRef`/`LayoutMode`/`SelectionRef`/`SearchHit`/`OutlineNode`/`UnifiedAnnotation` 转换相关类型
- **依赖**：T0.2
- **验收**：接口类型完整，PDF/EPUB 适配器骨架可空实现通过 tsc
- **参考**：ARCH §5

### T2.2 PDF 适配器：渲染与导航

- **目标**：embedpdf v2 接入渲染/导航/布局。
- **内容**：`engines/pdf/`：打开（`lec-file://` 流式 + 加密密码回调）、单页/连续/双页布局、缩放 10%–400%、视图旋转、页码跳转、`getPosition` 进度、缩略图懒加载、outline 目录 + 当前位置高亮
- **依赖**：T2.1、T1.2
- **验收**：打开 fixtures/text.pdf 渲染正确；三种布局切换；缩放/旋转/跳页正常；进度可读写
- **参考**：FRD §4.3.1、ARCH §4.1

### T2.3 PDF 适配器：七类批注与 sidecar 互转

- **目标**：七类批注全链路 + 统一模型序列化。
- **内容**：
  - 高亮/下划线/删除线/波浪线/便签/自由文本/手绘七类：创建、修改、删除、从 sidecar 恢复
  - `serialize`：引擎批注 ↔ `UnifiedAnnotation`（归一化 quad 坐标，旋转感知转换）
  - 缩放/旋转/布局切换后几何对齐
  - **风险处理**（FRD §2.3）：以 R0-02 verdict 决定 native / 应用层扩展 / fork 路线；未有 verdict 不开始正式实现
- **依赖**：T2.2、R0-02、R0-06
- **验收**：七类批注创建→导出 sidecar→清空→导入→几何与类型完整恢复；0/90/180/270 旋转下对齐
- **参考**：FRD §4.3.3、ARCH §10 风险对策

### T2.4 PDF 适配器：夜间模式

- **目标**：PDF 智能反色。
- **内容**：`setNightMode`：按 R0-03 的已验证分层能力实现；批注对比度保护（≥3:1）。不将全页 CSS 反色宣称为图片保真的智能反色。
- **依赖**：T2.2、R0-03、R0-06
- **验收**：text/scanned/mixed 三类样本：正文对比度 ≥4.5:1、图片无负片感、批注可辨
- **参考**：FRD §4.3.4、ARCH §10

### T2.5 EPUB 适配器：渲染与设置

- **目标**：epub.js 接入阅读核心。
- **内容**：`engines/epub/`：打开（ArrayBuffer + JSZip）、分页/滚动/双页、章节目录 + 当前位置高亮、全书搜索、阅读设置（字号 14–23/行距/页边距/三主题，按书记忆）
- **依赖**：T2.1
- **验收**：reflow.epub 渲染正确；章节跳转、设置热应用、搜索命中
- **参考**：FRD §4.4、ARCH §5

### T2.6 EPUB 适配器：选区锚定批注

- **目标**：EPUB 批注锚定与恢复。
- **内容**：选中文本 → 批注；`UnifiedAnnotation` 存 `epubCfi + quote`；恢复时 CFI 优先、文本回找降级（`resolved | ambiguous | orphaned` 三态，禁止静默跳错）；书签按章节定位
- **风险处理**：以 R0-04 verdict 确定 CFI、Range/TreeWalker 回找和失效态的实现边界
- **依赖**：T2.5、R0-04、R0-06
- **验收**：未改内容 EPUB 锚点恢复率 100%；改动后唯一匹配重定位、多匹配/无匹配标 orphaned
- **参考**：FRD §4.4、ARCH §6.3 锚点失效策略

### T2.7 EPUB 适配器：TTS 句级高亮

- **目标**：离线 TTS 朗读。
- **内容**：`TtsSession` 状态机（idle/playing/paused/stopping/error）；`Intl.Segmenter` 中英文分句；逐句 utterance 队列；当前句 DOM Range 高亮；暂停/继续/停止；章节切换续读；音色=系统已装语音
- **风险处理**：以 R0-05 verdict 确定句级 DOM 映射路线；若不可行，停止该能力并请求产品确认替代范围
- **依赖**：T2.5、R0-05、R0-06
- **验收**：中英文朗读、暂停/继续/停止、跨章推进、高亮跟读；断网可用
- **参考**：FRD §4.4/#27、ARCH §10

---

## M3 渲染层核心

### T3.1 Stores 状态层

- **目标**：五个 zustand store 落地。
- **内容**：`stores/`：tabs（≤20 上限）、library（recent/starred/folders/files 投影）、settings（config 投影 + antd token 派生）、fileData（当前文件 sidecar 投影）、ui（会话态）
- **依赖**：T0.2
- **验收**：store 单测覆盖各 reducer 关键分支
- **参考**：ARCH §7

### T3.2 Data 访问层

- **目标**：渲染侧持久化编排。
- **内容**：`data/`：500ms 防抖写、undo/redo 栈（会话级 ≤50 步，批注增/改/删闭包）、锚点失效重定位（quote 回找 → orphaned）、schema 迁移调用、导入重映射
- **依赖**：T3.1、T0.3
- **验收**：防抖合并写入；undo/redo 单测；损坏 sidecar 不崩
- **参考**：FRD #26/#34、ARCH §7 undo/redo

### T3.3 Shell 外壳

- **目标**：标题栏、标签页、应用菜单、快捷键分发。
- **内容**：`shell/`：frameless 标题栏（Logo 回开始页 + 应用菜单 + 窗口三键）；标签页增删切换（开始页常驻不可关、中键关闭、Ctrl+W、溢出滚动、上限 20）；全局快捷键注册/分发（FRD §4.7 默认表）
- **依赖**：T3.1、T1.1
- **验收**：标签全交互可用；默认快捷键全表生效
- **参考**：FRD §4.2、§4.7

### T3.4 i18n 与 theme

- **目标**：中英双语 + 三主题。
- **内容**：i18next 资源（zh-CN/en-US 全量文案）；antd ConfigProvider 主题派生（浅/深/跟随系统，ConfigProvider 算法）
- **依赖**：T3.1
- **验收**：语言热切换全界面生效；跟随系统主题切换即时生效
- **参考**：FRD 决策 #16、ARCH §3.2 i18n/theme

---

## M4 页面与功能

### T4.1 StartPage 开始页

- **目标**：文件枢纽页面。
- **内容**：
  - 左侧导航：最近/星标/我的文档/书签与标注
  - 打开三入口（文件选择器、拖放、文件关联）、路径失效重定位（F4）
  - 最近列表（≤100 LRU、进度显示、星标置顶组）
  - 星标管理；我的文档（添加文件夹、扫描、移出库、删除走回收站）
  - 聚合视图：跨文件书签 + 批注列表（按文件/类型筛选、搜索、点击打开并定位）
- **依赖**：T3.2、T3.3、T1.3
- **验收**：上述交互全部可用；删除文件确认后进回收站；"移出库"不动磁盘文件
- **参考**：FRD §4.1、ARCH 流程图 4.4/4.8

### T4.2 Reader 阅读器容器（PDF）

- **目标**：PDF 阅读器页面。
- **内容**：`pages/reader/`：工具栏（缩放/布局/旋转/页码/适页适宽/全屏）、侧栏（缩略图/目录/书签/批注四 tab + 当前位置高亮）、状态栏、渲染视口；Ctrl+滚轮缩放；F11 全屏
- **依赖**：T2.2、T3.3
- **验收**：FRD §4.3.1 全部导航交互可用
- **参考**：FRD §4.3.1

### T4.3 PDF 批注 UI 与批注侧栏

- **目标**：批注工具条与侧栏。
- **内容**：七工具按钮 + 每类 5 色预设；批注侧栏（按页分组、类型图标/颜色/摘录/时间、点击定位、编辑改色改文、删除）；撤销/重做接入；侧栏数据经 fileData 实时防抖落盘
- **依赖**：T2.3、T4.2、T3.2
- **验收**：七类批注全交互；侧栏编辑/删除/定位；Ctrl+Z/Y 撤销重做
- **参考**：FRD §4.3.3

### T4.4 文档内搜索

- **目标**：PDF/EPUB 文档内搜索。
- **内容**：Ctrl+F 搜索栏：关键词、命中计数、上一个/下一个、大小写敏感；结果高亮 + 跳转（PDF 页码 / EPUB 章节）
- **依赖**：T2.2、T2.5、T4.2
- **验收**：两种格式搜索命中导航正确
- **参考**：FRD §4.3.2、§4.4

### T4.5 书签功能

- **目标**：用户书签（PDF 页/选区 + EPUB 章节）。
- **内容**：添加/命名/排序/删除/点击跳转；侧栏书签列表；与文件自带目录并存；聚合视图接入（T4.1）
- **依赖**：T3.2、T4.2、T2.6
- **验收**：PDF 收藏页码、EPUB 收藏章节均可跳转恢复
- **参考**：FRD §4.5

### T4.6 EPUB 阅读器页面

- **目标**：EPUB 阅读界面。
- **内容**：EPUB 工具栏（章节跳转/布局/搜索）、侧栏（目录/书签/批注）、阅读设置浮层（字号/行距/页边距/三主题）、选中文本工具条（高亮/下划线/删除线/波浪线/便签/复制）、TTS 控制条（语速/音色/句级高亮/暂停继续停止）
- **依赖**：T2.5、T2.6、T2.7、T4.2
- **验收**：FRD §4.4 全部交互可用
- **参考**：FRD §4.4

### T4.7 Settings 设置页

- **目标**：5 组设置。
- **内容**：通用（语言/开机启动/检查更新/存储占用+清缓存/导出导入/自动备份）、阅读（默认缩放/布局/PDF 夜间）、外观（浅/深/跟随系统）、批注（默认颜色）、快捷键（改键 + 冲突检测 + 恢复默认）
- **依赖**：T3.4、T1.5、T1.6
- **验收**：各组设置持久化到 config 并即时生效；快捷键冲突拦截
- **参考**：FRD §4.6

### T4.8 打印

- **目标**：原始 + 含批注打印。
- **内容**：系统打印对话框；仅原文 / 原文+批注（可选层）、页码范围、缩放
- **风险处理**：批注合成渲染若 embedpdf `saveAsCopy` 缺 appearance，走独立 PrintComposer 渲染合成（打印专用 HTML/CSS 页面尺寸），不以屏幕可视代替打印可打
- **依赖**：T2.3、T4.2、R0-02、R0-06
- **验收**：两种模式打印输出页数/坐标与原文一致；含批注输出可被独立查看器看到七类批注
- **参考**：FRD §4.3.5、ARCH §10

### T4.9 加密 PDF 与崩溃恢复 UI

- **目标**：密码框 + 恢复提示。
- **内容**：打开加密 PDF 弹密码框（会话内记住、不落盘）；启动时 cleanExit=false 弹"恢复上次打开的文档？"（按 lastTabPaths 重开标签）
- **依赖**：T2.2、T1.4、T4.2
- **验收**：加密 PDF 密码验证后阅读、批注走 sidecar；强杀重启后恢复提示正常
- **参考**：FRD §4.9、ARCH 流程图 4.6

---

## M5 集成与交付

### T5.1 文件关联与打包

- **目标**：可安装交付物。
- **内容**：electron-builder NSIS 配置；`fileAssociations`（.pdf/.epub，用户可选不设默认）；单实例路由联调；安装包签名（如有证书）
- **依赖**：M4 全部
- **验收**：安装后双击 PDF 打开 LecPDF；二次双击路由到新标签
- **参考**：FRD §4.9

### T5.2 帮助/关于与协议合规

- **目标**：帮助菜单闭环 + 合规。
- **内容**：快捷键总览（跳设置页）、使用文档、检查更新、关于（版本号、引擎信息、开源协议声明 embedpdf Apache-2.0 / epub.js BSD-2-Clause 等）
- **依赖**：T1.6、T4.7
- **验收**：关于页协议声明完整可核对
- **参考**：FRD §4.10

### T5.3 性能达标与内存策略

- **目标**：FRD 非功能指标。
- **内容**：≤200MB/≤2000 页打开 ≤3s、翻页首屏 ≤300ms、滚动 60fps；>200MB 轻量模式（关预渲染/缩略图懒加载 + 警告）；非活动标签释放位图；单标签峰值 ≤500MB；渲染缓存 2GB LRU + 设置页清理
- **依赖**：M4 全部
- **验收**：按 FRD §5 指标逐项实测通过
- **参考**：FRD §5、ARCH §8

### T5.4 崩溃恢复压测与交付审计

- **目标**：稳定性验收。
- **内容**：强杀/断电模拟下数据零丢失验证（实时写盘 + 备份兜底）；schema 高版本只读保护验证；零遥测审计（无外发请求）；安装/卸载/升级全流程冒烟
- **依赖**：M5 前三个任务
- **验收**：崩溃后最多丢 500ms 内操作；审计无网络请求；卸载干净
- **参考**：FRD §5、ARCH §6.4

---

## 风险处置规则（v2.0）

| 风险 | 验证门禁 | 正式实现 | 不可行时的处理 |
|---|---|---|---|
| 下划线 / 删除线 / 波浪线、批注打印 | R0-02 | LEC-020、LEC-041 采用已验证的 native / extension / fork 路线 | 标记 `blocked`，请求产品决定；不以相似高亮假冒已支持的类型 |
| PDF 智能反色 | R0-03 | LEC-021 仅实现通过阈值的路线 | 不承诺“智能”或图片保真；保留已验证的基础暗色阅读能力 |
| EPUB 选区锚定 | R0-04 | LEC-024 使用实证通过的 CFI/回找模型 | 明确显示 orphaned；不静默重定位 |
| EPUB TTS 句级高亮 | R0-05 | LEC-025 使用实证通过的本机语音和 DOM 映射 | 无语音时提示；不可行时等待产品确认是否接受替代范围 |
| EPUB 引擎可替换性 | R0-04、R0-05 | `engines/epub/` 保持适配器边界 | 不能因引擎局限扩散到业务层 |

## 推荐开发顺序

1. M0：LEC-001→003→004→005/006，并完成 LEC-002 的视觉基础。
2. M1、M3 与 PDF 基础阅读并行：主进程服务、Shell/状态/i18n/theme、PDF 打开/缩放/目录/搜索。
3. 开始批注/打印、夜间模式、EPUB 批注或 TTS 前，分别运行对应 R0；不做未验证的风险功能。
4. 按 verdict 接入风险能力，再完成开始页的数据源与聚合、设置、安装、性能和稳定性 HITL 门禁。

详细领取顺序、依赖和验收项以 `LecPDF-ISSUES.md` 为准；本文不再承担逐 Issue 的状态记录。
