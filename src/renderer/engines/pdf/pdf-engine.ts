import type { ReaderEngine } from '../types'

export class PdfEngine implements ReaderEngine {
  readonly kind = 'pdf' as const
  readonly layout = unsupported('layout')
  readonly view = unsupported('view')
  readonly selection = unsupported('selection')
  readonly annotations = unsupported('annotations')
  open = unsupported('open')
  close = unsupported('close')
  outline = unsupported('outline')
  search = unsupported('search')
}
function unsupported(feature: string): never { throw new Error(`PDF 引擎尚未实现：${feature}`) }
