import { describe, expect, it } from 'vitest'
import {
  COLLAPSED_REPLY_MAX_HEIGHT,
  REPLY_COLLAPSE_OVERFLOW_THRESHOLD,
  shouldCollapseReplyContentFromMetrics
} from './collapsibleReply'

describe('shouldCollapseReplyContentFromMetrics', () => {
  it('仅在内容明显超出收起窗口时折叠', () => {
    const threshold = COLLAPSED_REPLY_MAX_HEIGHT + REPLY_COLLAPSE_OVERFLOW_THRESHOLD
    expect(shouldCollapseReplyContentFromMetrics(threshold)).toBe(true)
    expect(shouldCollapseReplyContentFromMetrics(threshold - 1)).toBe(false)
  })

  it('略高于收起高度但未达溢出阈值时不折叠', () => {
    expect(shouldCollapseReplyContentFromMetrics(COLLAPSED_REPLY_MAX_HEIGHT + 40)).toBe(false)
  })
})
