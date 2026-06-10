import { describe, expect, test } from 'vitest'
import { V2exClient } from './client'
import type {
  AccountOverview,
  MemberContent,
  MemberInfo,
  Node,
  SoV2exSource,
  Topic,
  TopicDetail,
  V2exNotification
} from './types'

const v2exCookie = process.env.V2EX_COOKIE

const client = new V2exClient(v2exCookie)

/**
 * 可选登录态测试
 */
const authTest = v2exCookie ? test : test.skip

/**
 * 校验话题列表项
 * @param topic 话题列表项
 */
function expectTopic(topic: Topic) {
  expect(topic.id).toEqual(expect.any(Number))
  expect(topic.id).toBeGreaterThan(0)
  expect(topic.title).toEqual(expect.any(String))
  expect(topic.title.length).toBeGreaterThan(0)
  expect(topic.node.name).toEqual(expect.any(String))
  expect(topic.node.title).toEqual(expect.any(String))
  expect(topic.replies).toEqual(expect.any(Number))
  expect(topic.replies).toBeGreaterThanOrEqual(0)
}

/**
 * 校验分页话题列表
 * @param result 分页话题列表
 */
function expectTopicListResult(result: { totalPage: number; list: Topic[] }) {
  expect(result.totalPage).toEqual(expect.any(Number))
  expect(result.totalPage).toBeGreaterThanOrEqual(1)
  expect(Array.isArray(result.list)).toBe(true)
  if (result.list.length) {
    expectTopic(result.list[0])
  }
}

/**
 * 校验节点
 * @param node 节点
 */
function expectNode(node: Node) {
  expect(node.name).toEqual(expect.any(String))
  expect(node.name.length).toBeGreaterThan(0)
  expect(node.title).toEqual(expect.any(String))
  expect(node.title.length).toBeGreaterThan(0)
}

/**
 * 校验话题详情
 * @param detail 话题详情
 */
function expectTopicDetail(detail: TopicDetail) {
  expect(detail.id).toEqual(expect.any(Number))
  expect(detail.id).toBeGreaterThan(0)
  expect(detail.title).toEqual(expect.any(String))
  expect(detail.title.length).toBeGreaterThan(0)
  expectNode(detail.node)
  expect(detail.authorName).toEqual(expect.any(String))
  expect(detail.authorName.length).toBeGreaterThan(0)
  expect(detail.displayTime).toEqual(expect.any(String))
  expect(detail.visitCount).toEqual(expect.any(Number))
  expect(detail.visitCount).toBeGreaterThanOrEqual(0)
  expect(detail.content).toEqual(expect.any(String))
  expect(Array.isArray(detail.appends)).toBe(true)
  expect(detail.collectCount).toEqual(expect.any(Number))
  expect(detail.thankCount).toEqual(expect.any(Number))
  expect(detail.replyCount).toEqual(expect.any(Number))
  expect(detail.replyCurrentPage).toEqual(expect.any(Number))
  expect(detail.replyCurrentPage).toBeGreaterThanOrEqual(1)
  expect(detail.replyTotalPage).toEqual(expect.any(Number))
  expect(detail.replyTotalPage).toBeGreaterThanOrEqual(1)
  expect(Array.isArray(detail.replies)).toBe(true)
}

/**
 * 校验账户概览
 * @param overview 账户概览
 */
function expectAccountOverview(overview: AccountOverview) {
  expect(overview.avatar).toEqual(expect.any(String))
  expect(overview.username).toEqual(expect.any(String))
  expect(overview.nodeCollectionCount).toEqual(expect.any(Number))
  expect(overview.topicCollectionCount).toEqual(expect.any(Number))
  expect(overview.specialFollowingCount).toEqual(expect.any(Number))
  expect(overview.activityPercent).toEqual(expect.any(Number))
  expect(overview.unreadNoticeCount).toEqual(expect.any(Number))
  expect(overview.gold).toEqual(expect.any(Number))
  expect(overview.silver).toEqual(expect.any(Number))
  expect(overview.bronze).toEqual(expect.any(Number))
  expect(overview.nodeCollectionCount).toBeGreaterThanOrEqual(0)
  expect(overview.topicCollectionCount).toBeGreaterThanOrEqual(0)
  expect(overview.specialFollowingCount).toBeGreaterThanOrEqual(0)
  expect(overview.activityPercent).toBeGreaterThanOrEqual(0)
  expect(overview.unreadNoticeCount).toBeGreaterThanOrEqual(0)
  expect(overview.gold).toBeGreaterThanOrEqual(0)
  expect(overview.silver).toBeGreaterThanOrEqual(0)
  expect(overview.bronze).toBeGreaterThanOrEqual(0)
}

/**
 * 校验提醒消息
 * @param notification 提醒消息
 */
function expectNotification(notification: V2exNotification) {
  expect(notification.id).toEqual(expect.any(Number))
  expect(notification.id).toBeGreaterThan(0)
  expect(notification.avatar).toEqual(expect.any(String))
  expect(notification.username).toEqual(expect.any(String))
  expect(notification.memberPath).toEqual(expect.any(String))
  expect(notification.summaryHtml).toEqual(expect.any(String))
  expect(notification.time).toEqual(expect.any(String))
  expect(notification.payloadHtml).toEqual(expect.any(String))
}

/**
 * 校验用户基本信息
 * @param member 用户基本信息
 */
function expectMemberInfo(member: MemberInfo) {
  expect(member.username).toEqual(expect.any(String))
  expect(member.username.length).toBeGreaterThan(0)
  expect(member.avatar).toEqual(expect.any(String))
  expect(member.memberNumber).toEqual(expect.any(Number))
  expect(member.memberNumber).toBeGreaterThanOrEqual(0)
  expect(member.joinedAt).toEqual(expect.any(String))
}

/**
 * 校验用户活动内容
 * @param content 用户活动内容
 */
function expectMemberContent(content: MemberContent) {
  expect(content.page).toEqual(expect.any(Number))
  expect(content.totalPage).toEqual(expect.any(Number))
  expect(Array.isArray(content.topics)).toBe(true)
  expect(Array.isArray(content.replies)).toBe(true)
}

/**
 * 校验 SoV2EX 搜索结果
 * @param source 搜索结果
 */
function expectSearchSource(source: SoV2exSource) {
  expect(source.id).toEqual(expect.any(Number))
  expect(source.id).toBeGreaterThan(0)
  expect(source.member).toEqual(expect.any(String))
  expect(source.title).toEqual(expect.any(String))
  expect(source.title.length).toBeGreaterThan(0)
  expect(source.content).toEqual(expect.any(String))
  expect(source.replies).toEqual(expect.any(Number))
  expect(source.created).toEqual(expect.any(String))
}

describe.concurrent('V2exClient topic links', () => {
  test('builds and parses topic links', () => {
    expect(client.getTopicLinkById(703733)).toBe('https://www.v2ex.com/t/703733')
    expect(client.getTopicLinkById('1136705')).toBe('https://www.v2ex.com/t/1136705')
    expect(client.getTopicIdByLink('/t/1136705#reply50')).toBe(1136705)
    expect(client.getTopicIdByLink('https://www.v2ex.com/t/703733#reply12')).toBe(703733)
    expect(client.getTopicIdByLink('/go/v2ex')).toBeUndefined()
  })
})

describe.concurrent('V2exClient topics', () => {
  test('gets once token', async () => {
    await expect(client.getOnce()).resolves.toMatch(/^\d+$/)
  })

  test('gets topics by tab', async () => {
    const topics = await client.getTopicListByTab('tech')

    expect(topics.length).toBeGreaterThan(0)
    expectTopic(topics[0])
  })

  test('gets topics by node', async () => {
    const result = await client.getTopicListByNode('v2ex')

    expect(result.totalPage).toEqual(expect.any(Number))
    expect(result.totalPage).toBeGreaterThanOrEqual(0)
    expect(result.totalCount).toEqual(expect.any(Number))
    expect(result.totalCount).toBeGreaterThan(0)
    expect(result.list.length).toBeGreaterThan(0)
    expectTopic(result.list[0])
    expect(result.list[0].node.name).toBe('v2ex')
  })

  test('gets topic detail from a known public topic', async () => {
    const detail = await client.getTopicDetail(703733)

    expect(detail.id).toBe(703733)
    expect(detail.title).toBe('写了一个 VSCode 上可以逛 V2EX 的插件')
    expect(detail.node).toEqual({
      name: 'create',
      title: '分享创造'
    })
    expect(detail.authorName).toBe('chaselen')
    expect(detail.displayTime).toBe('2020 年 9 月 3 日')
    expect(detail.content).toContain('V2EX Playground')
    expect(detail.replyCount).toBeGreaterThanOrEqual(42)
    expect(detail.replies.length).toBeGreaterThanOrEqual(42)
    expect(detail.replyCurrentPage).toBe(1)
    expect(detail.replies[0]).toMatchObject({
      replyId: '9452335',
      userName: 'polaa',
      floor: '1'
    })
    expectTopicDetail(detail)
  })
})

describe.concurrent('V2exClient members', () => {
  test('gets member info and default activity from public member page', async () => {
    const member = await client.getMemberInfo('livid')
    const content = await client.getMemberContent('livid')

    expect(member.username.toLowerCase()).toBe('livid')
    expect(member.memberNumber).toBe(1)
    expect(member.joinedAt).toContain('2010-04-25')
    if (member.activityRank !== undefined) {
      expect(member.activityRank).toBeGreaterThan(0)
    }
    expect(content.tab).toBe('topics')
    expect(content.topics.length).toBeGreaterThan(0)
    expectMemberInfo(member)
    expectMemberContent(content)
    expectTopic(content.topics[0])
  })

  test('handles hidden member topic list and keeps recent replies', async () => {
    const hiddenTopics = await client.getMemberContent('suzhaharcan')
    const replies = await client.getMemberContent('chaselen', { tab: 'replies' })

    expect(hiddenTopics.hidden).toBe(true)
    expect(hiddenTopics.message).toMatch(/hidden|隐藏/)
    expect(replies.replies.length).toBeGreaterThan(0)
    expectMemberContent(hiddenTopics)
    expectMemberContent(replies)
  })

  test('gets member category topics', async () => {
    const content = await client.getMemberContent('livid', { tab: 'qna' })

    expect(content.tab).toBe('qna')
    expect(content.topics.length).toBeGreaterThan(0)
    expectTopic(content.topics[0])
    expectMemberContent(content)
  })

  test('gets paged member topics and replies', async () => {
    const topics = await client.getMemberContent('livid', { tab: 'topics', page: 2 })
    const replies = await client.getMemberContent('livid', { tab: 'replies', page: 2 })

    expect(topics.tab).toBe('topics')
    expect(topics.page).toBe(2)
    expect(topics.totalPage).toBeGreaterThanOrEqual(2)
    expect(topics.topics.length).toBeGreaterThan(0)
    expect(replies.tab).toBe('replies')
    expect(replies.page).toBe(2)
    expect(replies.totalPage).toBeGreaterThanOrEqual(2)
    expect(replies.replies.length).toBeGreaterThan(0)
    expectMemberContent(topics)
    expectMemberContent(replies)
  })
})

describe.concurrent('V2exClient nodes', () => {
  test('gets all nodes', async () => {
    const nodes = await client.getAllNodes()

    expect(nodes.length).toBeGreaterThan(0)
    expectNode(nodes[0])
  })
})

describe.concurrent('V2exClient search', () => {
  test('searches SoV2EX', async () => {
    const results = await client.search('vscode')

    expect(Array.isArray(results)).toBe(true)
    if (results.length) {
      expectSearchSource(results[0])
    }
  })
})

describe('V2exClient authenticated requests', () => {
  authTest('tries login from V2EX_COOKIE', async () => {
    await expect(client.tryLogin(v2exCookie!)).resolves.toBe(true)
  })

  authTest('refreshes the authenticated session with V2EX_COOKIE', async () => {
    await expect(client.checkCookie()).resolves.toBe(true)
  })

  authTest('gets account overview with V2EX_COOKIE', async () => {
    const overview = await client.getAccountOverview()

    expectAccountOverview(overview)
  })

  authTest('gets collection nodes with V2EX_COOKIE', async () => {
    const nodes = await client.getCollectionNodes()

    expect(Array.isArray(nodes)).toBe(true)
    if (nodes.length) {
      expectNode(nodes[0])
    }
  })

  authTest('gets collection topics with V2EX_COOKIE', async () => {
    const result = await client.getCollectionTopics()

    expectTopicListResult(result)
  })

  authTest('gets special following topics with V2EX_COOKIE', async () => {
    const result = await client.getSpecialFollowingTopics()

    expectTopicListResult(result)
  })

  authTest('gets notifications with V2EX_COOKIE', async () => {
    const result = await client.getNotifications()

    expect(result.totalPage).toEqual(expect.any(Number))
    expect(result.totalPage).toBeGreaterThanOrEqual(1)
    expect(result.totalCount).toEqual(expect.any(Number))
    expect(result.totalCount).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(result.list)).toBe(true)
    if (result.list.length) {
      expectNotification(result.list[0])
    }
  })

  authTest('signs in daily and returns the reward with V2EX_COOKIE', async () => {
    const result = await client.dailySignIn()

    expect(['success', 'repetitive']).toContain(result.result)
    expect(result.reward).toEqual(expect.any(Number))
    expect(result.reward).toBeGreaterThan(0)
    await expect(client.getDailySignInStatus()).resolves.toBe(true)
    await expect(client.getDailySignInReward()).resolves.toBe(result.reward)
  })
})
