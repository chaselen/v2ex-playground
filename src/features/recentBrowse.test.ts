import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { RecentBrowseTopic } from '@/shared/webview'
import { getReadTopicIds, isTopicRead } from './recentBrowse'

const mocks = vi.hoisted(() => ({
  globalStateGet: vi.fn(),
  globalStateUpdate: vi.fn()
}))

vi.mock('@/global', () => ({
  default: {
    context: {
      globalState: {
        get: mocks.globalStateGet,
        update: mocks.globalStateUpdate
      }
    }
  }
}))

/**
 * 创建最近浏览记录
 * @param topicId 话题 id
 * @param overrides 覆盖字段
 */
function createRecord(
  topicId: number,
  overrides: Partial<RecentBrowseTopic> = {}
): RecentBrowseTopic {
  return {
    topicId,
    title: `title-${topicId}`,
    authorName: 'author',
    authorAvatar: '',
    nodeName: 'programmer',
    nodeTitle: '程序员',
    publishedAt: '2026-08-01 12:00:00',
    readAt: Date.now(),
    ...overrides
  }
}

describe('getReadTopicIds', () => {
  beforeEach(() => {
    mocks.globalStateGet.mockReset()
    mocks.globalStateUpdate.mockReset()
    mocks.globalStateUpdate.mockResolvedValue(undefined)
  })

  test('returns ids of current read records', () => {
    mocks.globalStateGet.mockReturnValue({
      1: createRecord(1),
      2: createRecord(2)
    })

    expect(getReadTopicIds().sort((a, b) => a - b)).toEqual([1, 2])
    expect(isTopicRead(1)).toBe(true)
    expect(isTopicRead(3)).toBe(false)
  })

  test('excludes expired and incomplete records', () => {
    mocks.globalStateGet.mockReturnValue({
      1: createRecord(1),
      2: createRecord(2, { title: '' }),
      3: createRecord(3, { readAt: Date.now() - 31 * 24 * 60 * 60 * 1000 })
    })

    expect(getReadTopicIds()).toEqual([1])
    expect(isTopicRead(2)).toBe(false)
    expect(isTopicRead(3)).toBe(false)
  })
})
