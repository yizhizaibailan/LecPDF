# LecPDF EPUB TTS 句级高亮验证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在离线 Electron 环境中验证中英文 TTS 的播放、暂停、继续、停止、跨段落/章节推进与句级高亮，并隔离系统语音差异。

**Architecture:** `TtsSession` 只依赖 `SpeechDriver`、`SentenceSource` 和 `HighlightSink` 三个接口。单元测试使用确定性 fake driver；Electron lab 使用本机 `speechSynthesis`，优先逐句 utterance 队列，避免依赖不同平台不一致的 word boundary 事件。

**Tech Stack:** Electron 44.0.0、epubjs 0.3.93、Web Speech API、`Intl.Segmenter`、Vitest 4.1.10。

**Spec:** `docs/superpowers/specs/2026-08-27-lecpdf-technical-risk-validation-design.md`

## Global Constraints

- 仅使用本机已安装语音；禁用网络后仍须工作。
- 产品只保证枚举实际可用音色，不保证每台设备音色名称相同。
- 中英文必须支持播放、暂停、继续、停止和跨章节推进。
- 高亮单位是当前句；不能用整段高亮冒充句级高亮。
- 若 Web Speech 路线不可用，先验证开源本地引擎；商业 SDK 必须另行批准。

---

### Task 1: 实现确定性的中英文分句

**Files:**
- Create: `spikes/labs/epub-tts/sentence-segmenter.ts`
- Test: `spikes/tests/epub-tts-segmentation.test.ts`

**Interfaces:**
- Produces: `SentenceSegment { id, text, start, end, lang }`；`segmentSentences(text, lang)`。
- Consumes: `Intl.Segmenter`。

- [ ] **Step 1: 写中英文及标点失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { segmentSentences } from '../labs/epub-tts/sentence-segmenter';

describe('sentence segmentation', () => {
  it('segments Chinese punctuation without losing offsets', () => {
    const text = '第一句。第二句！“第三句？”';
    const items = segmentSentences(text, 'zh-CN');
    expect(items.map((x) => x.text)).toEqual(['第一句。', '第二句！', '“第三句？”']);
    expect(items.map((x) => text.slice(x.start, x.end))).toEqual(items.map((x) => x.text));
  });
  it('keeps English abbreviations in their sentence', () => {
    expect(segmentSentences('Dr. Lee reads. Then stops.', 'en-US').map((x) => x.text))
      .toEqual(['Dr. Lee reads.', 'Then stops.']);
  });
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `corepack pnpm vitest run tests/epub-tts-segmentation.test.ts`

Expected: FAIL，segmenter 不存在。

- [ ] **Step 3: 实现分句器**

Use `new Intl.Segmenter(lang, { granularity: 'sentence' })`; retain original UTF-16 offsets. Filter whitespace-only segments and trim only the returned text boundaries while adjusting start/end. Do not add a regex fallback unless Electron 44 reports `Intl.Segmenter` unavailable; that condition must be a failing capability check.

- [ ] **Step 4: 运行测试和检查点**

Run: `corepack pnpm vitest run tests/epub-tts-segmentation.test.ts`

Expected: PASS。

Commit if Git exists; otherwise record Task 1 in `Execution Notes`.

### Task 2: 用 fake driver 完成 TtsSession 状态机

**Files:**
- Create: `spikes/labs/epub-tts/contracts.ts`
- Create: `spikes/labs/epub-tts/tts-session.ts`
- Test: `spikes/tests/epub-tts-session.test.ts`

**Interfaces:**
- Produces: `SpeechDriver`、`HighlightSink`、`SentenceSource`、`TtsSession`。
- Consumes: `SentenceSegment`。

- [ ] **Step 1: 定义接口和状态测试**

```ts
export interface SpeechDriver {
  voices(): Promise<Array<{ id: string; name: string; lang: string }>>;
  speak(text: string, options: { lang: string; voiceId?: string; rate: number }): Promise<void>;
  pause(): void; resume(): void; cancel(): void;
}
export interface HighlightSink { show(segment: SentenceSegment): Promise<void>; clear(): Promise<void> }
export interface SentenceSource { current(): Promise<SentenceSegment[]>; nextChapter(): Promise<SentenceSegment[] | null> }
```

```ts
it('pauses, resumes, advances sentences, crosses chapter and stops cleanly', async () => {
  const session = makeSessionWithFakeDriver();
  await session.play();
  session.pause();
  expect(session.state()).toBe('paused');
  session.resume();
  await session.finished();
  expect(session.spokenTexts()).toEqual(['chapter 1 sentence', 'chapter 2 sentence']);
  expect(session.state()).toBe('idle');
});
```

- [ ] **Step 2: 运行失败测试**

Run: `corepack pnpm vitest run tests/epub-tts-session.test.ts`

Expected: FAIL，TtsSession 不存在。

- [ ] **Step 3: 实现状态机**

Allowed states: `idle | playing | paused | stopping | error`. Before each `speak`, call `highlight.show(sentence)`; resolve one utterance before advancing. `stop()` cancels the driver, clears highlight and invalidates the active generation token so a late `onend` cannot advance the queue.

- [ ] **Step 4: 增加竞态测试**

Test stop during speak, pause before onend, repeated play, chapter exhaustion and driver rejection. Each must finish without duplicate sentences or stale highlight.

- [ ] **Step 5: 运行全状态测试和检查点**

Run: `corepack pnpm vitest run tests/epub-tts-session.test.ts`

Expected: PASS, including race cases.

Commit if Git exists; otherwise record Task 2.

### Task 3: 接入 epub.js iframe 高亮和本机 Web Speech

**Files:**
- Create: `spikes/labs/epub-tts/web-speech-driver.ts`
- Create: `spikes/labs/epub-tts/epub-sentence-source.ts`
- Create: `spikes/labs/epub-tts/epub-highlight-sink.ts`
- Create: `spikes/labs/epub-tts/index.tsx`
- Test: `spikes/tests/epub-tts-driver.test.ts`

**Interfaces:**
- Consumes: epub.js rendition contents and relocation events；browser `speechSynthesis`。
- Produces: `runTtsChecks(): Promise<LabResult>`。

- [ ] **Step 1: 写 Web Speech 包装器测试**

Mock `speechSynthesis` and assert `speak()` resolves on `utterance.onend`, rejects on `onerror`, and `voices()` waits for `voiceschanged` with a 2-second timeout before returning an empty list.

- [ ] **Step 2: 实现本机 driver**

Create one `SpeechSynthesisUtterance` per sentence. Set `lang`, `rate` and an exact voice object matched by stable `voiceURI`. Do not use browser/network voice names as defaults; choose the first local voice whose language prefix matches.

- [ ] **Step 3: 实现 iframe sentence source and highlight sink**

Walk visible text nodes in current epub.js contents, segment their concatenated text while retaining node/offset maps, create a DOM Range for the active sentence, and render one highlight mark. Remove the previous mark before showing the next. On chapter advance, wait for rendition `rendered` before rebuilding mappings.

- [ ] **Step 4: 运行离线人工矩阵**

Disable network through the baseline gate. In the lab, test one Chinese and one English chapter: play, pause for 2 seconds, resume, stop mid-sentence, restart, cross paragraph, cross chapter and change font size during playback. Record installed voice metadata without machine user paths.

- [ ] **Step 5: 判定与保存证据**

- `原生支持`: direct Web Speech boundary events alone meet every requirement.
- `应用层扩展`: local sentence queue + epub.js Range highlight meets every requirement.
- `需要 fork`: epub.js iframe lifecycle blocks stable mapping and a source patch fixes it.
- `开源不可行`: neither Web Speech nor an approved open-source local engine can meet offline bilingual requirements.

Save `spikes/results/epub-tts.json`, including state transitions and manual checks. Set `commercialDecision` to `not-needed` unless the verdict is `开源不可行`; in that case set `pending` and request user approval before any commercial download or trial.

- [ ] **Step 6: 全量验证和检查点**

Run: `corepack pnpm test; corepack pnpm build`

Expected: all unit tests PASS, Electron lab completes with network disabled, build exits 0.

Commit if Git exists; otherwise record Task 3 in `Execution Notes`.

## Execution Notes

不得初始化 Git；人工结果须记录操作系统、Electron 版本、语言和 voiceURI，但不记录用户名或设备路径。
