/**
 * 预加载脚本的新构建入口。
 * 当前转交既有受限 API 实现，后续迁移全部 preload 文件时保持对渲染层的 `window.lec` 契约不变。
 */
import '../../src/preload/index'
