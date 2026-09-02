/**
 * 职责：验证 vanilla Zustand Store 可通过 React 服务端快照安全选择并渲染状态切片。
 * 异步说明：本测试使用 SSR 快照，因此不建立客户端订阅或需要释放的资源。
 */
import { createStore } from 'zustand/vanilla'
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useStoreSelector } from './use-store-selector'

test('服务端渲染读取 vanilla Store 的选中状态切片', () => {
  const store = createStore(() => ({ title: 'guide.pdf', count: 1 }))

  function SelectedTitle(): JSX.Element {
    return <p>{useStoreSelector(store, (state) => state.title)}</p>
  }

  expect(renderToStaticMarkup(<SelectedTitle />)).toContain('guide.pdf')
})
