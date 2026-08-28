import { expect, test } from 'vitest'
import { createAppApi } from './api'

test('exposes only an immutable application version value', () => {
  const api = createAppApi('0.1.0')

  expect(api).toEqual({ app: { version: '0.1.0' } })
  expect(Object.isFrozen(api)).toBe(true)
  expect(Object.isFrozen(api.app)).toBe(true)
})
