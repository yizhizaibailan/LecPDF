import { Icon } from '@iconify/react/offline'
import book2Linear from '@iconify-icons/solar/book-2-linear'

type SolarIconProps = {
  name: string
  width?: string | number
  className?: string
  'aria-hidden'?: boolean
}

const solarIcons = {
  'book-2-linear': book2Linear
}

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
