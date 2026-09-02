/**
 * 职责：提供 PDF 内容检索、大小写匹配与结果定位；导出 PdfSearchBar。
 * 订阅说明：搜索结果订阅在 effect 清理，避免关闭搜索栏后异步结果回写局部状态。
 */
import { useEffect, useRef, useState } from 'react'
import { MatchFlag } from '@embedpdf/models'
import { SearchPlugin, type PluginRegistry } from '@embedpdf/react-pdf-viewer'

export function PdfSearchBar({ registry, onClose }: { registry: PluginRegistry | null; onClose(): void }): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [searching, setSearching] = useState(false)
  const search = () => registry?.getPlugin<SearchPlugin>(SearchPlugin.id)?.provides() ?? null

  useEffect(() => {
    inputRef.current?.focus()
    const service = search()
    if (service === null) return
    const unsubscribeResult = service.onSearchResult(({ results }) => {
      setTotal(results.total)
      setActiveIndex(results.total > 0 ? 0 : -1)
      setSearching(false)
    })
    const unsubscribeActive = service.onActiveResultChange(({ index }) => setActiveIndex(index))
    return () => { unsubscribeResult(); unsubscribeActive() }
  }, [registry])

  const runSearch = (matchCase = caseSensitive): void => {
    const keyword = query.trim()
    const service = search()
    if (service === null) return
    if (keyword.length === 0) {
      service.stopSearch(); setTotal(0); setActiveIndex(-1)
      return
    }
    service.startSearch()
    service.setFlags(matchCase ? [MatchFlag.MatchCase] : [])
    setSearching(true)
    void service.searchAllPages(keyword).toPromise()
      .then(({ total: nextTotal }) => { setTotal(nextTotal); setActiveIndex(nextTotal > 0 ? 0 : -1) })
      .catch(() => { setTotal(0); setActiveIndex(-1) })
      .finally(() => setSearching(false))
  }
  const disabled = registry === null
  const matchLabel = searching ? '搜索中…' : total === 0 ? '无匹配' : `${activeIndex + 1} / ${total}`

  return (
    <form className="reader-search" aria-label="PDF 文档内搜索" onSubmit={(event) => { event.preventDefault(); runSearch() }}>
      <input ref={inputRef} aria-label="搜索 PDF 内容" placeholder="在文档中搜索" value={query} disabled={disabled} onChange={(event) => setQuery(event.target.value)} />
      <span className="reader-search__count" aria-live="polite">{matchLabel}</span>
      <button type="button" aria-label="上一个搜索结果" disabled={disabled || total === 0} onClick={() => setActiveIndex(search()?.previousResult() ?? -1)}>上一个</button>
      <button type="button" aria-label="下一个搜索结果" disabled={disabled || total === 0} onClick={() => setActiveIndex(search()?.nextResult() ?? -1)}>下一个</button>
      <label className="reader-search__case"><input aria-label="大小写敏感" type="checkbox" checked={caseSensitive} disabled={disabled} onChange={(event) => { const next = event.target.checked; setCaseSensitive(next); runSearch(next) }} />区分大小写</label>
      <button type="submit" disabled={disabled}>搜索</button>
      <button type="button" aria-label="关闭 PDF 搜索" onClick={() => { search()?.stopSearch(); onClose() }}>关闭</button>
    </form>
  )
}
