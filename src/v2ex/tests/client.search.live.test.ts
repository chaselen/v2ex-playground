import { describe, test } from 'vitest'
import { V2exClient } from '../client'
import { expectSearchResult, expectSearchSource } from './client.liveTestAssertions'

describe('V2exClient search', () => {
  test('searches SoV2EX', async () => {
    const result = await new V2exClient().search({
      q: 'vscode',
      from: 0,
      size: 20,
      sort: 'created',
      order: 0,
      operator: 'and'
    })

    expectSearchResult(result)
    if (result.hits.length) {
      expectSearchSource(result.hits[0].source)
    }
  })
})
