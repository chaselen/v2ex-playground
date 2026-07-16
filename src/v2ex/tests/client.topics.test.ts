import { describe, expect, test } from 'vitest'
import { V2exClient } from '../client'

describe('V2exClient topic links', () => {
  const client = new V2exClient()

  test('builds and parses topic links', () => {
    expect(client.getTopicLinkById(703733)).toBe('https://www.v2ex.com/t/703733')
    expect(client.getTopicLinkById('1136705')).toBe('https://www.v2ex.com/t/1136705')
    expect(client.getTopicIdByLink('/t/1136705#reply50')).toBe(1136705)
    expect(client.getTopicIdByLink('https://www.v2ex.com/t/703733#reply12')).toBe(703733)
    expect(client.getTopicIdByLink('/go/v2ex')).toBeUndefined()
    expect(client.getTagLink('VS Code')).toBe('https://www.v2ex.com/tag/VS%20Code')
  })
})
