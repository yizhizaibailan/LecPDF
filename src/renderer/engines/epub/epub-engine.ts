import type { ReaderEngine } from '../types'

export class EpubEngine implements ReaderEngine {
  readonly kind = 'epub' as const
  readonly layout = unsupported('layout')
  readonly view = unsupported('view')
  readonly selection = unsupported('selection')
  readonly annotations = unsupported('annotations')
  open = unsupported('open')
  close = unsupported('close')
  outline = unsupported('outline')
  search = unsupported('search')
}
function unsupported(feature: string): never { throw new Error(`EPUB 引擎尚未实现：${feature}`) }
