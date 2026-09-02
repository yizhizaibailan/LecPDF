/**
 * 职责：让 React 组件以 useSyncExternalStore 安全订阅 vanilla Zustand Store 的状态切片。
 * 异步与资源说明：React 在组件卸载时调用 Store 返回的取消订阅函数，本 Hook 不持有额外资源。
 */
import { useSyncExternalStore } from 'react'
import type { StoreApi } from 'zustand/vanilla'

/**
 * 订阅指定 Store 并返回选择器计算的切片，同时提供服务端渲染所需的当前快照。
 * 服务端快照与客户端初始快照均从同一 Store 读取，避免预渲染文档标签与客户端首帧不一致。
 */
export function useStoreSelector<TState, TSlice>(
  store: StoreApi<TState>,
  selector: (state: TState) => TSlice
): TSlice {
  const getSnapshot = (): TSlice => selector(store.getState())
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
