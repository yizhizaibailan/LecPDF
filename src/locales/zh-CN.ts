/**
 * 集中保存当前壳层的中文文案，避免布局组件继续散落硬编码字符串。
 * 后续 i18n 接入时会以相同键名补充其他语言资源，而无需改变组件的语义结构。
 */
export const ZH_CN = {
  appName: 'LecPDF',
  window: {
    minimize: '最小化窗口',
    toggleMaximize: '最大化或还原窗口',
    close: '关闭窗口'
  }
} as const
