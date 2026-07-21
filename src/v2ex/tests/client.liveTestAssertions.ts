import { expect } from 'vitest'
import type {
  AccountOverview,
  BalanceDetail,
  MemberContent,
  MemberInfo,
  Node,
  SoV2exSearchResult,
  SoV2exSource,
  Topic,
  TopicDetail,
  V2exNotification
} from '../types'

/**
 * 校验话题列表项
 * @param topic 话题列表项
 */
export function expectTopic(topic: Topic) {
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
export function expectTopicListResult(result: { totalPage: number; list: Topic[] }) {
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
export function expectNode(node: Node) {
  expect(node.name).toEqual(expect.any(String))
  expect(node.name.length).toBeGreaterThan(0)
  expect(node.title).toEqual(expect.any(String))
  expect(node.title.length).toBeGreaterThan(0)
  if (node.avatar) {
    expect(node.avatar).toMatch(/^https?:\/\//)
  }
  if (node.description) {
    expect(node.description.length).toBeGreaterThan(0)
  }
}

/**
 * 校验话题详情
 * @param detail 话题详情
 */
export function expectTopicDetail(detail: TopicDetail) {
  expect(detail.id).toEqual(expect.any(Number))
  expect(detail.id).toBeGreaterThan(0)
  expect(detail.title).toEqual(expect.any(String))
  expect(detail.title.length).toBeGreaterThan(0)
  expectNode(detail.node)
  expect(Array.isArray(detail.tags)).toBe(true)
  expect(detail.authorName).toEqual(expect.any(String))
  expect(detail.authorName.length).toBeGreaterThan(0)
  expect(detail.topicIcon).toMatch(/^https?:\/\//)
  expect(detail.displayTime).toEqual(expect.any(String))
  expect(detail.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
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
  if (detail.replies.length) {
    const reply = detail.replies[0]
    expect(reply.time).toEqual(expect.any(String))
    expect(reply.time.length).toBeGreaterThan(0)
    expect(reply.repliedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(reply.isMod).toEqual(expect.any(Boolean))
    expect(reply.isOp).toEqual(expect.any(Boolean))
    expect(reply.isPro).toEqual(expect.any(Boolean))
  }
}

/**
 * 校验账户概览
 * @param overview 账户概览
 */
export function expectAccountOverview(overview: AccountOverview) {
  expect(overview.avatar).toEqual(expect.any(String))
  expect(overview.username).toEqual(expect.any(String))
  expect(overview.tagline).toEqual(expect.any(String))
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
 * 校验账户余额详情
 * @param detail 账户余额详情
 */
export function expectBalanceDetail(detail: BalanceDetail) {
  expect(detail.gold).toEqual(expect.any(Number))
  expect(detail.silver).toEqual(expect.any(Number))
  expect(detail.bronze).toEqual(expect.any(Number))
  expect(detail.page).toBeGreaterThanOrEqual(1)
  expect(detail.totalPage).toBeGreaterThanOrEqual(detail.page)
  expect(Array.isArray(detail.transactions)).toBe(true)
  if (detail.transactions.length) {
    expect(detail.transactions[0]).toMatchObject({
      key: expect.any(String),
      time: expect.any(String),
      type: expect.any(String),
      amount: expect.any(String),
      direction: expect.stringMatching(/^(positive|negative|neutral)$/),
      balance: expect.any(String),
      description: expect.any(String),
      descriptionHtml: expect.any(String)
    })
  }
}

/**
 * 校验提醒消息
 * @param notification 提醒消息
 */
export function expectNotification(notification: V2exNotification) {
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
export function expectMemberInfo(member: MemberInfo) {
  expect(member.username).toEqual(expect.any(String))
  expect(member.username.length).toBeGreaterThan(0)
  expect(member.avatar).toEqual(expect.any(String))
  expect(member.tagline).toEqual(expect.any(String))
  expect(member.bio).toEqual(expect.any(String))
  expect(member.memberNumber).toEqual(expect.any(Number))
  expect(member.memberNumber).toBeGreaterThanOrEqual(0)
  expect(member.joinedAt).toEqual(expect.any(String))
  expect(member.isPro).toEqual(expect.any(Boolean))
}

/**
 * 校验用户活动内容
 * @param content 用户活动内容
 */
export function expectMemberContent(content: MemberContent) {
  expect(content.page).toEqual(expect.any(Number))
  expect(content.totalPage).toEqual(expect.any(Number))
  expect(Array.isArray(content.topics)).toBe(true)
  expect(Array.isArray(content.replies)).toBe(true)
}

/**
 * 校验 SoV2EX 搜索结果项
 * @param source 搜索结果项
 */
export function expectSearchSource(source: SoV2exSource) {
  expect(source.node).toEqual(expect.any(Number))
  expect(source.id).toEqual(expect.any(Number))
  expect(source.id).toBeGreaterThan(0)
  expect(source.member).toEqual(expect.any(String))
  expect(source.title).toEqual(expect.any(String))
  expect(source.title.length).toBeGreaterThan(0)
  expect(source.content).toEqual(expect.any(String))
  expect(source.replies).toEqual(expect.any(Number))
  expect(source.created).toEqual(expect.any(String))
}

/**
 * 校验 SoV2EX 搜索结果
 * @param result 搜索结果
 */
export function expectSearchResult(result: SoV2exSearchResult) {
  expect(result.took).toEqual(expect.any(Number))
  expect(result.timedOut).toEqual(expect.any(Boolean))
  expect(result.total).toEqual(expect.any(Number))
  expect(result.total).toBeGreaterThanOrEqual(0)
  expect(Array.isArray(result.hits)).toBe(true)
}
