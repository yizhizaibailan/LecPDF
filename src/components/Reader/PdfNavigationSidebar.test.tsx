/**
 * 职责：验证 PDF 导航侧栏公开的缩略图与目录切换入口。
 * 导出项：本文件不导出运行时代码，仅覆盖 PdfNavigationSidebar 的公开渲染契约。
 * 资源说明：静态渲染测试不创建订阅或对象 URL，运行时 cleanup 由组件 effect 负责。
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThumbnailPlugin, type PluginRegistry } from '@embedpdf/react-pdf-viewer'
import { PdfNavigationSidebar } from './PdfNavigationSidebar'

const lifecycle = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
  stateValues: [] as unknown[],
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  refs: [] as unknown[]
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect()
      if (typeof cleanup === 'function') lifecycle.cleanups.push(cleanup)
    },
    useRef: <T,>(initial: T) => ({ current: (lifecycle.refs.shift() ?? initial) as T }),
    useState: <T,>(initial: T | (() => T)) => {
      const value = lifecycle.stateValues.length > 0
        ? lifecycle.stateValues.shift() as T
        : typeof initial === 'function' ? (initial as () => T)() : initial
      const setter = vi.fn()
      lifecycle.setters.push(setter)
      return [value, setter] as [T, typeof setter]
    }
  }
})

beforeEach(() => {
  lifecycle.cleanups.length = 0
  lifecycle.stateValues.length = 0
  lifecycle.setters.length = 0
  lifecycle.refs.length = 0
})

afterEach(() => vi.unstubAllGlobals())

test('导航侧栏提供缩略图和目录标签', () => {
  const html = renderToStaticMarkup(<PdfNavigationSidebar registry={null} />)

  expect(html).toContain('aria-label="打开 PDF 缩略图"')
  expect(html).toContain('aria-label="打开 PDF 目录"')
})

test('缩略图在卸载后完成时立即释放对象 URL 且不写入状态', async () => {
  let resolveBlob: (blob: Blob) => void = () => undefined
  const lateBlob = new Blob(['thumbnail'])
  const renderThumb = vi.fn(() => ({ toPromise: () => new Promise<Blob>((resolve) => { resolveBlob = resolve }) }))
  const registry = {
    getPlugin: (id: string) => id === ThumbnailPlugin.id ? { provides: () => ({ renderThumb, updateWindow: vi.fn(), onWindow: vi.fn(() => () => undefined) }) } : undefined
  } as unknown as PluginRegistry
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:late-thumbnail')
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.stubGlobal('window', { devicePixelRatio: 1 })
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} })
  lifecycle.stateValues.push('thumbnails', [], 1, [{ pageIndex: 0, width: 120, height: 160, top: 0, labelHeight: 16 }], 176, null)
  lifecycle.refs.push({ scrollTop: 0, clientHeight: 200, addEventListener: () => undefined, removeEventListener: () => undefined })

  renderToStaticMarkup(<PdfNavigationSidebar registry={registry} />)
  for (const cleanup of lifecycle.cleanups) cleanup()
  resolveBlob(lateBlob)
  await Promise.resolve()

  expect(createObjectURL).toHaveBeenCalledWith(lateBlob)
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:late-thumbnail')
  expect(lifecycle.setters.at(-1)).not.toHaveBeenCalled()
})
