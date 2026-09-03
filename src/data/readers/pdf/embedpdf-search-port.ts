/**
 * 将 EmbedPDF 搜索插件适配为通用 PDF 搜索端口。
 * 搜索栏不再导入插件或匹配枚举，避免 UI 层与具体阅读内核耦合。
 */
import { MatchFlag } from '@embedpdf/models'
import { SearchPlugin, type PluginRegistry } from '@embedpdf/react-pdf-viewer'
import type { PdfSearchPort } from './pdf-search-controller'

/** 从 EmbedPDF 注册表创建搜索端口；插件尚未就绪时命令安全地返回空结果。 */
export function createEmbedPdfSearchPort(registry: PluginRegistry): PdfSearchPort {
  const search = () => registry.getPlugin<SearchPlugin>(SearchPlugin.id)?.provides() ?? null
  let state = { total: 0, activeIndex: -1, searching: false }
  return {
    search(query, matchCase) {
      const service = search()
      if (service === null) return
      state = { ...state, searching: true }
      service.startSearch()
      service.setFlags(matchCase ? [MatchFlag.MatchCase] : [])
      void service.searchAllPages(query).toPromise().then(({ total }) => { state = { total, activeIndex: total > 0 ? 0 : -1, searching: false } }).catch(() => { state = { total: 0, activeIndex: -1, searching: false } })
    },
    stop: () => { search()?.stopSearch(); state = { total: 0, activeIndex: -1, searching: false } },
    previous: () => search()?.previousResult() ?? -1,
    next: () => search()?.nextResult() ?? -1,
    getState: () => state,
    subscribe(listener) {
      const service = search()
      listener(state)
      if (service === null) return () => undefined
      const removeResults = service.onSearchResult(({ results }) => { state = { total: results.total, activeIndex: results.total > 0 ? 0 : -1, searching: false }; listener(state) })
      const removeActive = service.onActiveResultChange(({ index }) => { state = { ...state, activeIndex: index }; listener(state) })
      return () => { removeResults(); removeActive() }
    }
  }
}
