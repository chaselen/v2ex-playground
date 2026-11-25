import { Readable } from 'node:stream'
import { expect, test, vi } from 'vitest'
import G from '@/global'
import type { TopicDetail, TopicReply } from '@/v2ex'
import { getCachedTopicSummary, prepareTopicSummary, saveTopicSummary } from './topicSummary'
import type { TopicSummaryModel } from './topicSummaryModel'

vi.mock('@/global', () => ({
  default: {
    context: { globalState: { get: vi.fn(), update: vi.fn() } }
  }
}))

test('stores one successful summary per topic', async () => {
  const state = new Map<string, unknown>()
  vi.mocked(G.context.globalState.get).mockImplementation(key => state.get(key))
  vi.mocked(G.context.globalState.update).mockImplementation(async (key, value) => {
    state.set(key, value)
  })
  const coverage = { pages: 1, totalPages: 1, replies: 2, totalReplies: 2, truncated: false }
  await saveTopicSummary(1, { text: '旧总结', model: '模型', coverage })
  const latest = { text: '新总结', model: '模型', coverage }
  await saveTopicSummary(1, latest)
  expect(getCachedTopicSummary(1)).toEqual(latest)
  expect(getCachedTopicSummary(2)).toBeUndefined()
})

function topic(replyCurrentPage: number, replies: Pick<TopicReply, 'floor' | 'content'>[]) {
  return {
    id: 1,
    title: '测试话题',
    content: '<p>主楼文字</p><script>不发送</script>',
    appends: [{ content: '<p>第一行<br>第二行 &amp; 说明</p>' }],
    replyCurrentPage,
    replyTotalPage: 5,
    replyCount: 8,
    replies: replies.map(reply => ({ ...reply, replyId: reply.floor }))
  } as TopicDetail
}

const model: TopicSummaryModel = {
  name: '测试模型',
  fits: async () => true,
  stream: async () => Readable.from([])
}

test('starts from page one, de-duplicates reply IDs and reports the sampled range', async () => {
  const first = topic(1, [{ floor: '1', content: '<p>第一条</p>' }])
  const second = topic(2, [
    { floor: '1', content: '重复回复' },
    { floor: '2', content: '<img src="https://example.test/image">' },
    { floor: '3', content: '第三条' }
  ])
  const third = topic(3, [{ floor: '4', content: '第四条' }])
  const loadPage = vi.fn(async (page: number) => [first, second, third][page - 1])
  const result = await prepareTopicSummary(second, loadPage, model, new AbortController().signal)
  expect(loadPage.mock.calls).toEqual([[1], [2], [3]])
  expect(result.input.source).toBe(
    '标题：测试话题\n主楼：主楼文字\n附言：第一行\n第二行 & 说明\n回复：\n#1 第一条\n#3 第三条\n#4 第四条'
  )
  expect(result.coverage).toEqual({
    pages: 3,
    totalPages: 5,
    replies: 3,
    totalReplies: 8,
    truncated: true
  })
})

test('keeps the reply prefix within the model budget without fetching subsequent pages', async () => {
  const first = topic(1, [
    { floor: '1', content: '可纳入' },
    { floor: '2', content: '超过预算' },
    { floor: '3', content: '后续回复' }
  ])
  const loadPage = vi.fn()
  const constrained: TopicSummaryModel = {
    ...model,
    fits: async ({ source }) => !source.includes('#2')
  }
  const result = await prepareTopicSummary(
    first,
    loadPage,
    constrained,
    new AbortController().signal
  )
  expect(loadPage).not.toHaveBeenCalled()
  expect(result.input.source).toContain('#1 可纳入')
  expect(result.input.source).not.toContain('#2')
  expect(result.coverage).toMatchObject({ pages: 1, replies: 1, truncated: true })
})

test('stops collecting when canceled while fetching a page', async () => {
  const abort = new AbortController()
  const loadPage = vi.fn(async () => {
    abort.abort()
    return topic(2, [])
  })
  await expect(prepareTopicSummary(topic(1, []), loadPage, model, abort.signal)).rejects.toThrow()
  expect(loadPage.mock.calls).toEqual([[2]])
})
