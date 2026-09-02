import { Icon } from '@iconify/react/offline'
import book2Linear from '@iconify-icons/solar/book-2-linear'

/**
 * 描述本地 Solar 图标组件接受的展示参数，避免页面直接依赖 Iconify 的底层类型。
 */
type SolarIconProps = {
  name: string
  width?: string | number
  className?: string
  'aria-hidden'?: boolean
}

const solarIcons = {
  'book-2-linear': book2Linear
}

/**
 * 从本地注册表渲染 Solar 图标；未知名称直接抛错，防止界面静默显示空白占位符。
 */
export function SolarIcon({ name, width, className, 'aria-hidden': ariaHidden }: SolarIconProps): JSX.Element {
  if (!Object.hasOwn(solarIcons, name)) {
    throw new Error(`未知 solar 图标：${name}`)
  }

  const icon = solarIcons[name as keyof typeof solarIcons]

  return (
    <Icon
      aria-hidden={ariaHidden}
      className={className}
      data-icon={`solar:${name}`}
      icon={icon}
      width={width}
    />
  )
}
