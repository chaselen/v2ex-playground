import { describe, expect, test, vi } from 'vitest'
import { V2exClient } from '../client'
import { V2exSession } from '../session'
import { getResponseUrl } from '../clientUtils'
import { expectNode } from './client.liveTestAssertions'

const authTest = process.env.V2EX_COOKIE ? test : test.skip

describe('V2exClient nodes', () => {
  test('gets the same node by name and id', async () => {
    const client = new V2exClient()
    const byName = await client.nodes.getInfo({ name: 'promotions' })
    const byId = await client.nodes.getInfo({ id: byName.id })
    expect(byName).toMatchObject({ id: 864, name: 'promotions', title: '推广' })
    expect(byId).toMatchObject({ id: byName.id, name: byName.name, title: byName.title })
  })

  test('reads promotions node page and authenticated ignore state', async () => {
    const client = new V2exClient(process.env.V2EX_COOKIE)
    const result = await client.nodes.getTopics('promotions')
    expect(result.node.name).toBe('promotions')
    expect(result.node.title).toBe('推广')
    if (process.env.V2EX_COOKIE) {
      expect(typeof result.node.isIgnored).toBe('boolean')
    } else {
      expect(result.node.isIgnored).toBeUndefined()
    }
  })

  authTest('updates ignored state in both directions and restores it', async () => {
    const client = new V2exClient(process.env.V2EX_COOKIE)
    const original = (await client.nodes.getTopics('promotions')).node.isIgnored
    expect(typeof original).toBe('boolean')
    const get = vi.spyOn(V2exSession.prototype, 'get')
    try {
      if (original) await client.nodes.cancelIgnore('promotions')
      const ignored = await client.nodes.ignore('promotions')
      expect(ignored.isIgnored).toBe(true)
      expect((await client.nodes.getTopics('promotions')).node.isIgnored).toBe(true)
      const restored = await client.nodes.cancelIgnore('promotions')
      expect(restored.isIgnored).toBe(false)
      expect((await client.nodes.getTopics('promotions')).node.isIgnored).toBe(false)
      const responses = await Promise.all(
        get.mock.results.filter(result => result.type === 'return').map(result => result.value)
      )
      const mutations = responses.filter(response =>
        /^\/settings\/(?:un)?ignore\/node\//.test(response.config.url ?? '')
      )
      expect(mutations.length).toBeGreaterThanOrEqual(2)
      for (const response of mutations) {
        expect(new URL(getResponseUrl(response)).pathname).toBe('/go/promotions')
      }
    } finally {
      try {
        // 重复取消忽略不会返回成功提示，仅在状态确实变化时恢复
        const current = (await client.nodes.getTopics('promotions')).node.isIgnored
        if (current !== original) {
          if (original) await client.nodes.ignore('promotions')
          else await client.nodes.cancelIgnore('promotions')
        }
        expect((await client.nodes.getTopics('promotions')).node.isIgnored).toBe(original)
      } finally {
        get.mockRestore()
        client.dispose()
      }
    }
  })

  test('gets all nodes from official JSON API', async () => {
    const client = new V2exClient()
    const nodes = await client.nodes.getAll()

    expect(nodes.length).toBeGreaterThan(1000)
    expectNode(nodes[0])
    expect(nodes.every(node => Number.isSafeInteger(node.id) && node.id > 0)).toBe(true)
    expect(nodes.every(node => node.name.length > 0 && node.title.length > 0)).toBe(true)
    expect(nodes.some(node => typeof node.collectCount === 'number')).toBe(true)
    expect(nodes.every(node => typeof node.topicCount === 'number')).toBe(true)
    expect(nodes.some(node => Boolean(node.avatar))).toBe(true)
    expect(nodes.every(node => !node.avatar || /^https:\/\//.test(node.avatar))).toBe(true)
    expect(nodes.every(node => !node.avatar?.includes('node_default'))).toBe(true)

    const programmer = nodes.find(node => node.name === 'programmer')
    expect(programmer).toMatchObject({
      name: 'programmer',
      title: '程序员'
    })
    expect(typeof programmer?.collectCount).toBe('number')
    expect(typeof programmer?.topicCount).toBe('number')

    const cached = await client.nodes.getAll()
    expect(cached).toBe(nodes)
  })
})
