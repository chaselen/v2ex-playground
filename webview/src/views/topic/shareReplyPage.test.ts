import { expect, it } from 'vitest'
import type { TopicDetail } from '@extension/v2ex/types'
import {
  getCurrentShareReplyPage,
  shareReplyPageReducer,
  type ShareReplyPageState
} from './shareReplyPage'

function topic(mode: TopicDetail['replyThreadStyle'], id = 1): TopicDetail {
  return { id, replyThreadStyle: mode, replies: [{ replyId: '1', floor: '1' }] } as TopicDetail
}

it('keeps the fetched mode and replies together when official settings changed since the panel loaded', () => {
  const source = topic('c'),
    page = topic('off')
  let state: ShareReplyPageState = shareReplyPageReducer(
    { status: 'idle' },
    { type: 'load', source, requestId: 1 }
  )
  state = shareReplyPageReducer(state, { type: 'loaded', requestId: 1, page })
  expect(getCurrentShareReplyPage(state, source)).toBe(page)
  expect(getCurrentShareReplyPage(state, source)?.replyThreadStyle).toBe('off')
  expect(getCurrentShareReplyPage(state, source)?.replies).toBe(page.replies)
})

it('does not expose the cached first page after the same topic has refreshed', () => {
  const original = topic('c'),
    refreshed = { ...original, replyCount: 2 }
  let state: ShareReplyPageState = {
    status: 'ready',
    requestId: 1,
    source: original,
    page: original
  }
  expect(getCurrentShareReplyPage(state, refreshed)).toBeUndefined()
  state = shareReplyPageReducer(state, { type: 'load', requestId: 2, source: refreshed })
  expect(getCurrentShareReplyPage(state, refreshed)).toBeUndefined()
  const freshPage = {
    ...refreshed,
    replies: [...refreshed.replies, { ...refreshed.replies[0], replyId: '2', floor: '2' }]
  }
  state = shareReplyPageReducer(state, { type: 'loaded', requestId: 2, page: freshPage })
  expect(getCurrentShareReplyPage(state, refreshed)?.replies).toHaveLength(2)
})

it('ignores an earlier response or failure while a newer snapshot is loading', () => {
  const source = topic('c'),
    newer = topic('d')
  const current = shareReplyPageReducer(
    { status: 'idle' },
    { type: 'load', source: newer, requestId: 2 }
  )
  expect(shareReplyPageReducer(current, { type: 'loaded', requestId: 1, page: source })).toBe(
    current
  )
  expect(
    shareReplyPageReducer(current, { type: 'failed', requestId: 1, message: '旧请求失败' })
  ).toBe(current)
  const next = shareReplyPageReducer(current, { type: 'loaded', requestId: 2, page: newer })
  expect(getCurrentShareReplyPage(next, newer)).toBe(newer)
})

it('closing or disabling replies invalidates an in-flight snapshot, including after reopening', () => {
  const source = topic('c')
  let state = shareReplyPageReducer({ status: 'idle' }, { type: 'load', source, requestId: 1 })
  state = shareReplyPageReducer(state, { type: 'reset' })
  expect(shareReplyPageReducer(state, { type: 'loaded', requestId: 1, page: source })).toBe(state)
  state = shareReplyPageReducer(state, { type: 'load', source, requestId: 2 })
  expect(shareReplyPageReducer(state, { type: 'loaded', requestId: 1, page: source })).toBe(state)
})

it('a snapshot belonging to another topic is not displayed and current errors remain scoped to their source', () => {
  const source = topic('c'),
    other = topic('c', 2)
  const ready: ShareReplyPageState = { status: 'ready', requestId: 1, source, page: source }
  expect(getCurrentShareReplyPage(ready, other)).toBeUndefined()
  const loading = shareReplyPageReducer(ready, { type: 'load', source: other, requestId: 2 })
  expect(
    shareReplyPageReducer(loading, { type: 'failed', requestId: 2, message: '网络中断' })
  ).toEqual({ status: 'error', source: other, requestId: 2, message: '网络中断' })
})
