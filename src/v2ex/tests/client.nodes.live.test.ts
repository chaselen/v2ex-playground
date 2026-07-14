import { describe, expect, test } from 'vitest'
import { V2exClient } from '../client'
import { expectNode } from './client.liveTestAssertions'

describe('V2exClient nodes', () => {
  test('gets all nodes', async () => {
    const nodes = await new V2exClient().getAllNodes()

    expect(nodes.length).toBeGreaterThan(0)
    expectNode(nodes[0])
  })
})
