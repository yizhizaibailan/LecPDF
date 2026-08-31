import React from 'react'
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SolarIcon } from '../components/SolarIcon'
import { lecTheme } from './theme'

test('exposes the prototype palette through Ant Design tokens', () => {
  expect(lecTheme.token).toMatchObject({
    colorPrimary: '#1677ff',
    colorBgLayout: '#e8edf4',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    colorBorder: '#e2e8f0',
    borderRadius: 8,
    fontSize: 14
  })
})

test('renders an installed solar icon by its name without a network request', () => {
  const html = renderToStaticMarkup(React.createElement(SolarIcon, { name: 'book-2-linear' }))

  expect(html).toContain('data-icon="solar:book-2-linear"')
  expect(html).toContain('<svg')
})

test('rejects an unknown solar icon name instead of rendering a blank placeholder', () => {
  expect(() => renderToStaticMarkup(React.createElement(SolarIcon, { name: 'missing-icon' }))).toThrow(
    '未知 solar 图标：missing-icon'
  )
})
