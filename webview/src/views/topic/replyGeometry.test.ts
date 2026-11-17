import { afterEach, expect, test, vi } from 'vitest'
import { getReplyVerticalGeometry } from './replyGeometry'

afterEach(() => vi.unstubAllGlobals())

test.each([0.98, 0.99, 1])(
  'returns stable layout coordinates during dialog entry at scale %s',
  scale => {
    const root = {
      getBoundingClientRect: () => ({ top: 100, height: 1400 * scale })
    } as HTMLElement
    const row = {
      getBoundingClientRect: () => ({ top: 100 + 1217 * scale, height: 22 * scale })
    } as HTMLElement
    vi.stubGlobal('getComputedStyle', () => ({ height: '1400px' }))
    const position = getReplyVerticalGeometry(row, root)
    expect(position.top + position.height / 2).toBeCloseTo(1228, 8)
  }
)

test('a hidden container does not generate invalid coordinates', () => {
  const element = { getBoundingClientRect: () => ({ top: 0, height: 0 }) } as HTMLElement
  vi.stubGlobal('getComputedStyle', () => ({ height: 'auto' }))
  expect(getReplyVerticalGeometry(element, element)).toEqual({ top: 0, height: 0 })
})
