import { useEffect, useMemo, useRef, useState } from 'react';
import { PDFViewer } from '@embedpdf/react-pdf-viewer';
import type { PluginRegistry } from '@embedpdf/core';
import type { AnnotationCapability, AnnotationPlugin } from '@embedpdf/plugin-annotation';
import type { DocumentManagerCapability, DocumentManagerPlugin } from '@embedpdf/plugin-document-manager';
import type { RotateCapability, RotatePlugin } from '@embedpdf/plugin-rotate';
import type { ZoomCapability, ZoomPlugin } from '@embedpdf/plugin-zoom';
import {
  PdfAnnotationSubtype,
  PdfStandardFont,
  PdfTextAlignment,
  PdfVerticalAlignment,
  Rotation,
  type PdfAnnotationObject,
  type Rect,
} from '@embedpdf/models';
import fixtureUrl from '../../fixtures/text.pdf?url';
import pdfiumWasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import {
  EmbedPdfAnnotationAdapter,
  taskToPromise,
  type AnnotationEngineApi,
  type EngineTransferItem,
  type PageSpaceProvider,
} from './embedpdf-adapter';
import type { LabCheck, LabDefinition, LabHandle, LabResult } from '../../app/shared/lab-contract';

const LAB_ID = 'pdf-annotations-print';
const ANNOTATION_PLUGIN_ID = 'annotation';
const DOCUMENT_MANAGER_PLUGIN_ID = 'document-manager';
const ROTATE_PLUGIN_ID = 'rotate';
const ZOOM_PLUGIN_ID = 'zoom';

const FIXTURE_PAGE_WIDTH = 612;
const FIXTURE_PAGE_HEIGHT = 792;

function rect(x: number, y: number, width: number, height: number): Rect {
  return { origin: { x, y }, size: { width, height } };
}

/** Text markup region covering the fixture line "Stable text anchor: alpha beta gamma delta." at (72, 670). */
const MARKUP_RECT = rect(72, 669, 300, 16);

const TOOL_IDS = ['highlight', 'underline', 'strikeout', 'squiggly', 'textComment', 'freeText', 'ink'] as const;
type ToolId = (typeof TOOL_IDS)[number];
const TOOL_LABELS: Record<ToolId, string> = {
  highlight: '高亮',
  underline: '下划线',
  strikeout: '删除线',
  squiggly: '波浪线',
  textComment: '便签',
  freeText: '自由文本',
  ink: '手绘',
};

function makeFixtureAnnotationObject(type: ToolId, index: number): PdfAnnotationObject {
  const base = {
    id: `fixture-${type}`,
    pageIndex: 0,
    created: new Date('2026-08-28T00:00:00.000Z'),
    modified: new Date('2026-08-28T00:00:00.000Z'),
  };
  switch (type) {
    case 'highlight':
      return {
        ...base,
        type: PdfAnnotationSubtype.HIGHLIGHT,
        rect: MARKUP_RECT,
        segmentRects: [{ ...MARKUP_RECT, size: { ...MARKUP_RECT.size, width: MARKUP_RECT.size.width / TOOL_IDS.length } }],
        strokeColor: '#ffd54f',
        opacity: 0.5,
        contents: `highlight fixture ${index}`,
      } as PdfAnnotationObject;
    case 'underline':
      return {
        ...base,
        type: PdfAnnotationSubtype.UNDERLINE,
        rect: MARKUP_RECT,
        segmentRects: [{ ...MARKUP_RECT, size: { ...MARKUP_RECT.size, width: MARKUP_RECT.size.width / TOOL_IDS.length } }],
        strokeColor: '#1677ff',
        opacity: 0.9,
        contents: `underline fixture ${index}`,
      } as PdfAnnotationObject;
    case 'strikeout':
      return {
        ...base,
        type: PdfAnnotationSubtype.STRIKEOUT,
        rect: MARKUP_RECT,
        segmentRects: [{ ...MARKUP_RECT, size: { ...MARKUP_RECT.size, width: MARKUP_RECT.size.width / TOOL_IDS.length } }],
        strokeColor: '#f5222d',
        opacity: 0.9,
        contents: `strikeout fixture ${index}`,
      } as PdfAnnotationObject;
    case 'squiggly':
      return {
        ...base,
        type: PdfAnnotationSubtype.SQUIGGLY,
        rect: MARKUP_RECT,
        segmentRects: [{ ...MARKUP_RECT, size: { ...MARKUP_RECT.size, width: MARKUP_RECT.size.width / TOOL_IDS.length } }],
        strokeColor: '#722ed1',
        opacity: 0.9,
        contents: `squiggly fixture ${index}`,
      } as PdfAnnotationObject;
    case 'textComment':
      return {
        ...base,
        type: PdfAnnotationSubtype.TEXT,
        rect: rect(320 + index * 30, 660, 18, 18),
        contents: `note body ${index}`,
        strokeColor: '#fadb14',
      } as PdfAnnotationObject;
    case 'freeText':
      return {
        ...base,
        type: PdfAnnotationSubtype.FREETEXT,
        rect: rect(100, 540 - index * 60, 240, 40),
        contents: `free text body ${index}`,
        fontSize: 12,
        fontColor: '#111111',
        fontFamily: PdfStandardFont.Helvetica,
        textAlign: PdfTextAlignment.Left,
        verticalAlign: PdfVerticalAlignment.Top,
        opacity: 1,
      } as PdfAnnotationObject;
    case 'ink':
      return {
        ...base,
        type: PdfAnnotationSubtype.INK,
        rect: rect(90, 150, 150, 60),
        inkList: [{ points: [{ x: 100, y: 180 }, { x: 160, y: 200 }, { x: 220, y: 160 }] }],
        strokeWidth: 2,
        strokeColor: '#fa8c16',
        opacity: 1,
      } as PdfAnnotationObject;
  }
}

interface LabContext {
  annotation: AnnotationCapability;
  documentManager: DocumentManagerCapability;
  rotate: RotateCapability;
  zoom: ZoomCapability;
  adapter: EmbedPdfAnnotationAdapter;
}

function buildPageSpaceProvider(documentManager: DocumentManagerCapability): PageSpaceProvider {
  return {
    getPageSpace(pageIndex: number) {
      const document = documentManager.getActiveDocument();
      const page = document?.pages[pageIndex];
      if (page) {
        return {
          width: page.size.width,
          height: page.size.height,
          rotation: [0, 90, 180, 270][page.rotation] as 0 | 90 | 180 | 270,
        };
      }
      return { width: FIXTURE_PAGE_WIDTH, height: FIXTURE_PAGE_HEIGHT, rotation: 0 };
    },
  };
}

function buildEngineApi(annotation: AnnotationCapability): AnnotationEngineApi {
  return {
    importAnnotations(items: EngineTransferItem[]): void {
      annotation.importAnnotations(items as never);
    },
    exportAnnotations() {
      return annotation.exportAnnotations() as never;
    },
    commit() {
      return annotation.commit() as never;
    },
    createAnnotation(pageIndex: number, object: never, context?: never): void {
      annotation.createAnnotation(pageIndex, object, context);
    },
    updateAnnotation(pageIndex: number, id: string, patch: never): void {
      annotation.updateAnnotation(pageIndex, id, patch);
    },
    deleteAnnotation(pageIndex: number, id: string): void {
      annotation.deleteAnnotation(pageIndex, id);
    },
  };
}

function waitForDocument(documentManager: DocumentManagerCapability): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30_000;
    const timer = setInterval(() => {
      const document = documentManager.getActiveDocument();
      if (document && document.pageCount > 0) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error('document load timeout'));
      }
    }, 100);
  });
}

interface PdfAnnotationsLabProps {
  onContextReady?: (context: LabContext) => void;
}

function PdfAnnotationsLab({ onContextReady }: PdfAnnotationsLabProps) {
  const [context, setContext] = useState<LabContext | null>(null);
  const [status, setStatus] = useState<string>('等待 viewer 就绪…');
  const [sidecarText, setSidecarText] = useState<string>('');
  const contextRef = useRef<LabContext | null>(null);
  contextRef.current = context;

  useEffect(() => {
    if (context && onContextReady) onContextReady(context);
  }, [context, onContextReady]);

  const handleReady = (registry: PluginRegistry): void => {
    const annotationPlugin = registry.getPlugin(ANNOTATION_PLUGIN_ID) as AnnotationPlugin | null;
    const documentManagerPlugin = registry.getPlugin(DOCUMENT_MANAGER_PLUGIN_ID) as DocumentManagerPlugin | null;
    const rotatePlugin = registry.getPlugin(ROTATE_PLUGIN_ID) as RotatePlugin | null;
    const zoomPlugin = registry.getPlugin(ZOOM_PLUGIN_ID) as ZoomPlugin | null;
    if (!annotationPlugin || !documentManagerPlugin || !rotatePlugin || !zoomPlugin) {
      setStatus('插件缺失，viewer 初始化失败');
      return;
    }
    const annotation = annotationPlugin.provides();
    const documentManager = documentManagerPlugin.provides();
    const rotate = rotatePlugin.provides();
    const zoom = zoomPlugin.provides();
    const adapter = new EmbedPdfAnnotationAdapter(buildEngineApi(annotation), buildPageSpaceProvider(documentManager));
    setContext({ annotation, documentManager, rotate, zoom, adapter });
    setStatus('viewer 就绪。可手动操作或点击 Run checks。');
  };

  const activateTool = (tool: ToolId): void => {
    if (!context) return;
    context.annotation.setActiveTool(tool);
    setStatus(`已激活工具：${TOOL_LABELS[tool]}（请在文档上操作）`);
  };

  const exportSidecar = async (): Promise<void> => {
    if (!context) return;
    try {
      const records = await context.adapter.exportSidecar();
      setSidecarText(JSON.stringify(records, null, 2));
      setStatus(`已导出 sidecar：${records.length} 条批注`);
    } catch (error) {
      setStatus(`导出失败：${String(error)}`);
    }
  };

  const clearAnnotations = async (): Promise<void> => {
    if (!context) return;
    context.annotation.deleteAllAnnotations();
    await taskToPromise(context.annotation.commit());
    setStatus('已清空全部批注');
  };

  const importSidecar = async (): Promise<void> => {
    if (!context) return;
    try {
      const records = JSON.parse(sidecarText) as never;
      await context.adapter.importSidecar(records);
      setStatus('已导入 sidecar');
    } catch (error) {
      setStatus(`导入失败：${String(error)}`);
    }
  };

  const rotateView = (): void => {
    if (!context) return;
    context.rotate.rotateForward();
  };

  const zoomView = (delta: number): void => {
    if (!context) return;
    if (delta > 0) context.zoom.zoomIn();
    else context.zoom.zoomOut();
  };

  const runChecks = async (): Promise<void> => {
  const current = contextRef.current;
  if (!current) {
    setStatus('viewer 未就绪，无法运行检查');
    return;
  }
  setStatus('运行检查中…');
  try {
    const result = await runLabChecks(current);
    setSidecarText(JSON.stringify(result, null, 2));
    await window.lecSpike.saveResult(result);
    setStatus(`检查完成：verdict = ${result.verdict}`);
  } catch (error) {
    setStatus(`检查失败：${String(error)}`);
  }
};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderBottom: '1px solid #e5e7eb' }}>
        {TOOL_IDS.map((tool) => (
          <button key={tool} onClick={() => activateTool(tool)}>{TOOL_LABELS[tool]}</button>
        ))}
        <button onClick={() => void exportSidecar()}>Export sidecar</button>
        <button onClick={() => void clearAnnotations()}>Clear</button>
        <button onClick={() => void importSidecar()}>Import sidecar</button>
        <button onClick={rotateView}>Rotate 90°</button>
        <button onClick={() => zoomView(-1)}>Zoom -</button>
        <button onClick={() => zoomView(1)}>Zoom +</button>
        <button onClick={() => void runChecks()}>Run checks</button>
        <span style={{ alignSelf: 'center', marginLeft: 8, color: '#4b5563' }}>{status}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer
          config={{
            src: fixtureUrl,
            wasmUrl: pdfiumWasmUrl,
            fontFallback: null,
            fonts: { ui: null, signature: null },
          }}
          style={{ width: '100%', height: '100%' }}
          onReady={handleReady}
        />
      </div>
    </div>
  );
}

async function runLabChecks(context: LabContext): Promise<LabResult> {
  const { annotation, adapter } = context;
  const checks: LabCheck[] = [];

  await waitForDocument(context.documentManager);
  annotation.deleteAllAnnotations();
  await taskToPromise(annotation.commit());

  for (let index = 0; index < TOOL_IDS.length; index += 1) {
    const tool = TOOL_IDS[index];
    annotation.createAnnotation(0, makeFixtureAnnotationObject(tool, index));
  }
  await taskToPromise(annotation.commit());

  const exported = await adapter.exportSidecar();
  const expectedTypes = ['highlight', 'underline', 'strikeout', 'squiggly', 'note', 'freeText', 'ink'];
  for (const type of expectedTypes) {
    const found = exported.find((record) => record.type === type);
    checks.push({
      id: `export-${type}`,
      passed: Boolean(found),
      detail: found ? `${type} 已导出（${exported.filter((r) => r.type === type).length} 条）` : `${type} 缺失`,
    });
  }

  annotation.deleteAllAnnotations();
  await taskToPromise(annotation.commit());
  const afterClear = await adapter.exportSidecar();
  checks.push({ id: 'clear-empty', passed: afterClear.length === 0, detail: `清空后剩余 ${afterClear.length} 条` });

  await adapter.importSidecar(exported);
  const restored = await adapter.exportSidecar();
  for (const type of expectedTypes) {
    const found = restored.find((record) => record.type === type);
    checks.push({
      id: `restore-${type}`,
      passed: Boolean(found),
      detail: found ? `${type} 已恢复` : `${type} 恢复失败`,
    });
  }
  checks.push({ id: 'restore-count', passed: restored.length === exported.length, detail: `恢复 ${restored.length}/${exported.length} 条` });

  const allPassed = checks.every((check) => check.passed);
  return {
    labId: LAB_ID,
    verdict: allPassed ? '原生支持' : '应用层扩展',
    checks,
    evidence: ['@embedpdf/plugin-annotation@2.15.0', 'fixtures/text.pdf', 'sidecar round trip in Electron'],
    commercialDecision: { status: 'not-needed' },
  };
}

export const pdfAnnotationsPrintLab: LabDefinition = {
  id: LAB_ID,
  title: 'PDF 七类批注与打印验证',
  async mount(root: HTMLElement): Promise<LabHandle> {
    const { createRoot } = await import('react-dom/client');
    let context: LabContext | null = null;
    const reactRoot = createRoot(root);
    reactRoot.render(<PdfAnnotationsLab onContextReady={(ctx) => { context = ctx; }} />);
    return {
      async run(): Promise<LabResult> {
        if (!context) throw new Error('lab context not ready');
        return runLabChecks(context);
      },
      async dispose(): Promise<void> {
        reactRoot.unmount();
      },
    };
  },
};
