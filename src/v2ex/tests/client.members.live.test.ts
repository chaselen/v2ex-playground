import { describe, expect, test } from 'vitest'
import { V2exClient } from '../client'
import { expectMemberContent, expectMemberInfo, expectTopic } from './client.liveTestAssertions'

const client = new V2exClient()

describe.sequential('V2exClient members', () => {
  test('gets member info and default activity from public member page', async () => {
    const member = await client.getMemberInfo('livid')
    const content = await client.getMemberContent('livid')

    expect(member.username.toLowerCase()).toBe('livid')
    expect(member.memberNumber).toBe(1)
    expect(member.joinedAt).toContain('2010-04-25')
    expect(member.tagline).toBe('Remember the bigger green')
    expect(member.bio).toBe('')
    expect(member.isPro).toBe(true)
    if (member.activityRank !== undefined) {
      expect(member.activityRank).toBeGreaterThan(0)
    }
    expect(content.tab).toBe('topics')
    expect(content.topics.length).toBeGreaterThan(0)
    expectMemberInfo(member)
    expectMemberContent(content)
    expectTopic(content.topics[0])
  })

  test('distinguishes member tagline from bio', async () => {
    const member = await client.getMemberInfo('loading')

    expect(member.tagline).not.toBe('')
    expect(member.bio).not.toBe('')
    expect(member.tagline).not.toBe(member.bio)
    expectMemberInfo(member)
  })

  test('handles hidden member topic list', async () => {
    const hiddenTopics = await client.getMemberContent('suzhaharcan')

    expect(hiddenTopics.hidden).toBe(true)
    expect(hiddenTopics.message).toMatch(/hidden|隐藏/)
    expectMemberContent(hiddenTopics)
  })

  test('gets member category topics', async () => {
    const content = await client.getMemberContent('livid', { tab: 'qna' })

    expect(content.tab).toBe('qna')
    expect(content.topics.length).toBeGreaterThan(0)
    expectTopic(content.topics[0])
    expectMemberContent(content)
  })

  test('gets paged member replies', async () => {
    const replies = await client.getMemberContent('livid', { tab: 'replies', page: 2 })

    expect(replies.tab).toBe('replies')
    expect(replies.page).toBe(2)
    expect(replies.totalPage).toBeGreaterThanOrEqual(2)
    expect(replies.replies.length).toBeGreaterThan(0)
    expectMemberContent(replies)
  })
})
