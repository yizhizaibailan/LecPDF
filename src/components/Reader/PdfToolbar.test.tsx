/**
 * 职责：验证 PDF 工具栏在阅读器未就绪时仍暴露安全、可访问的控制入口。
 * 导出项：本文件不导出运行时代码，仅覆盖 PdfToolbar 的公开渲染契约。
 * 资源说明：静态渲染测试不创建订阅或对象 URL，运行时 cleanup 由组件 effect 负责。
 */
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PdfToolbar } from './PdfToolbar'

test('缺少 registry 时工具按钮禁用', () => {
  const html = renderToStaticMarkup(<PdfToolbar registry={null} />)

  expect(html).toContain('disabled=""')
  expect(html).toContain('aria-label="连续阅读"')
  expect(html).toContain('aria-label="顺时针旋转 90 度"')
})
