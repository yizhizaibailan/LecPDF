import type { ThemeConfig } from 'antd'

/**
 * 定义与产品原型一致的 Ant Design 主题 token。
 * 主题在根渲染入口统一注入，使后续页面和组件获得相同的颜色、圆角和字号基线。
 */
export const lecTheme = {
  token: {
    colorPrimary: '#1677ff',
    colorBgLayout: '#e8edf4',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    colorBorder: '#e2e8f0',
    borderRadius: 8,
    fontSize: 14
  }
} satisfies ThemeConfig
