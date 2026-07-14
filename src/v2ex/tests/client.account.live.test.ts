import { describe, expect, test } from 'vitest'
import { V2exClient } from '../client'
import {
  expectAccountOverview,
  expectBalanceDetail,
  expectNode,
  expectNotification,
  expectTopicListResult
} from './client.liveTestAssertions'

const v2exCookie = process.env.V2EX_COOKIE
const client = new V2exClient(v2exCookie)
const authTest = v2exCookie ? test : test.skip

describe('V2exClient account', () => {
  authTest('gets account overview with V2EX_COOKIE', async () => {
    expectAccountOverview(await client.getAccountOverview())
  })

  authTest('gets a paged balance with V2EX_COOKIE', async () => {
    expectBalanceDetail(await client.getBalance(2))
  })

  authTest('gets collection nodes with V2EX_COOKIE', async () => {
    const nodes = await client.getCollectionNodes()

    expect(Array.isArray(nodes)).toBe(true)
    if (nodes.length) {
      expectNode(nodes[0])
    }
  })

  authTest('gets collection topics with V2EX_COOKIE', async () => {
    expectTopicListResult(await client.getCollectionTopics())
  })

  authTest('gets special following topics with V2EX_COOKIE', async () => {
    expectTopicListResult(await client.getSpecialFollowingTopics())
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
    expect(result.reward).toBeGreaterThanOrEqual(0)
    if (result.result === 'success') {
      expect(result.reward).toBeGreaterThan(0)
      await expect(client.getDailySignInStatus()).resolves.toMatchObject({
        signedIn: true,
        reward: {
          date: result.rewardDate,
          reward: result.reward
        }
      })
    }
  })
})
