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

function topic(
  replyCurrentPage: number,
  replies: (Pick<TopicReply, 'floor' | 'content'> &
    Partial<Pick<TopicReply, 'userName' | 'isOp' | 'parent'>>)[]
) {
  return {
    id: 1,
    title: '测试话题',
    authorName: 'op',
    content: '<p>主楼文字</p><script>不发送</script>',
    appends: [{ content: '<p>第一行<br>第二行 &amp; 说明</p>' }],
    replyCurrentPage,
    replyTotalPage: 5,
    replyCount: 8,
    replies: replies.map(reply => ({
      userName: 'reader',
      isOp: false,
      ...reply,
      replyId: reply.floor
    }))
  } as TopicDetail
}

const model: TopicSummaryModel = {
  name: '测试模型',
  fits: async () => true,
  stream: async () => Readable.from([])
}

test('starts from page one, de-duplicates reply IDs and reports the sampled range', async () => {
  const first = topic(1, [{ floor: '1', userName: 'op', content: '<p>第一条</p>' }])
  const second = topic(2, [
    { floor: '1', content: '重复回复' },
    { floor: '2', content: '<img src="https://example.test/image">' },
    { floor: '3', content: '@op 第三条' }
  ])
  const third = topic(3, [
    {
      floor: '4',
      userName: '',
      isOp: true,
      content: '第四条',
      parent: { replyId: '1', floor: '1', userName: 'op', url: '#r_1', content: '第一条' }
    }
  ])
  const loadPage = vi.fn(async (page: number) => [first, second, third][page - 1])
  const result = await prepareTopicSummary(second, loadPage, model, new AbortController().signal)
  expect(loadPage.mock.calls).toEqual([[1], [2], [3]])
  expect(result.input.source).toBe(
    [
      '标题：测试话题',
      '发帖人：@op',
      '主楼：主楼文字',
      '附言：第一行\n第二行 & 说明',
      '回复：',
      '#1 [@op，楼主] 第一条',
      '#3 [@reader] @op 第三条',
      '#4 [作者未知，楼主，回复 #1] 第四条'
    ].join('\n')
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
  expect(result.input.source).toContain('#1 [@reader] 可纳入')
  expect(result.input.source).not.toContain('#2')
  expect(result.coverage).toMatchObject({ pages: 1, replies: 1, truncated: true })
})

test('labels parents without floors and deduplicates their quotes by reply ID', async () => {
  const parent = { replyId: '7', floor: '', userName: 'op', url: '#r_7', content: '第一段引文' }
  const first = topic(1, [
    { floor: '10', content: '第一次引用', parent },
    { floor: '11', content: '再次引用', parent },
    {
      floor: '12',
      content: '另一条回复',
      parent: { ...parent, replyId: '8', url: '#r_8', userName: '', content: '第二段引文' }
    },
    {
      floor: '13',
      content: '回应已纳入的回复',
      parent: { ...parent, replyId: '10', url: '#r_10', userName: 'reader', content: '第一次引用' }
    }
  ])
  first.replyTotalPage = 1
  const result = await prepareTopicSummary(first, vi.fn(), model, new AbortController().signal)
  expect(result.input.source.split('回复：\n')[1]).toBe(
    [
      '#10 [@reader，回复 @op] 第一次引用',
      '  @op 引文：第一段引文',
      '#11 [@reader，回复 @op] 再次引用',
      '#12 [@reader] 另一条回复',
      '  父回复 引文：第二段引文',
      '#13 [@reader，回复 @reader] 回应已纳入的回复'
    ].join('\n')
  )
})

test.each([80, 12, 1])(
  'uses spare budget for a missing parent quote (%i characters)',
  async limit => {
    const parent = {
      replyId: '4',
      floor: '4',
      userName: 'op',
      url: '#r_4',
      content: '<p>甲<br>' + '🍎'.repeat(85) + '</p>'
    }
    const first = topic(1, [
      { floor: '1', content: '缺少引文', parent: { ...parent, content: '<img>' } },
      { floor: '2', content: '可引用', parent },
      { floor: '3', content: '同一父楼层', parent },
      { floor: '4', content: '未能纳入的完整父回复' }
    ])
    const loadPage = vi.fn()
    const constrained: TopicSummaryModel = {
      ...model,
      fits: async ({ source }) => {
        const quote = source.split('引文：')[1]?.split('\n')[0] ?? ''
        return !source.includes('未能纳入的完整父回复') && Array.from(quote).length <= limit
      }
    }
    const result = await prepareTopicSummary(
      first,
      loadPage,
      constrained,
      new AbortController().signal
    )
    const lines = [
      '#1 [@reader，回复 #4] 缺少引文',
      '#2 [@reader，回复 #4] 可引用',
      '#3 [@reader，回复 #4] 同一父楼层'
    ]
    if (limit > 1) lines.splice(2, 0, '  #4 引文：甲 ' + '🍎'.repeat(limit - 3) + '…')
    expect(result.input.source.split('回复：\n')[1]).toBe(lines.join('\n'))
    expect(result.coverage.replies).toBe(3)
    expect(loadPage).not.toHaveBeenCalled()
  }
)

test('stops collecting when canceled while fetching a page', async () => {
  const abort = new AbortController()
  const loadPage = vi.fn(async () => {
    abort.abort()
    return topic(2, [])
  })
  await expect(prepareTopicSummary(topic(1, []), loadPage, model, abort.signal)).rejects.toThrow()
  expect(loadPage.mock.calls).toEqual([[2]])
})
