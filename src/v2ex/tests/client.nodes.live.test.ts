import { describe, expect, test } from 'vitest'
import { V2exClient } from '../client'
import { expectNode } from './client.liveTestAssertions'

describe('V2exClient nodes', () => {
  test('gets all nodes from official JSON API', async () => {
    const client = new V2exClient()
    const nodes = await client.getAllNodes()

    expect(nodes.length).toBeGreaterThan(1000)
    expectNode(nodes[0])
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

    const cached = await client.getAllNodes()
    expect(cached).toBe(nodes)
  })
})
