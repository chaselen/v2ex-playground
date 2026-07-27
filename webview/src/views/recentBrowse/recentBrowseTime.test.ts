import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { formatPublishedTime, formatReadTime } from './recentBrowseTime'

describe('formatPublishedTime', () => {
  const now = dayjs('2026-07-27 12:00:00')

  it.each([
    ['2026-07-27 11:59:30', '几秒前'],
    ['2026-07-27 11:42:00', '18 分钟前'],
    ['2026-07-27 09:30:00', '2 小时前'],
    ['2026-07-26 12:00:00', '7 月 26 日'],
    ['2025-12-31 23:59:00', '2025 年 12 月 31 日']
  ])('formats %s as %s', (timeText, expected) => {
    expect(formatPublishedTime(timeText, now)).toBe(expected)
  })

  it('keeps legacy display text unchanged', () => {
    expect(formatPublishedTime('1 小时前', now)).toBe('1 小时前')
  })
})

describe('formatReadTime', () => {
  it('formats the timestamp to minutes', () => {
    expect(formatReadTime(dayjs('2026-07-27 12:34:56').valueOf())).toBe('2026-07-27 12:34')
  })
})
