import { describe, expect, it } from 'vitest'
import { buildReplyTree, flattenReplyTree } from '../../../webview/src/views/topic/replyTree'
import { V2exClient } from '../client'

const client = new V2exClient(process.env.V2EX_COOKIE)

describe('official reply threads live', { concurrent: false }, () => {
  for (const [id, pages] of [
    [1030787, [1]],
    [1149556, [1, 2]],
    [1257325, [1, 2]]
  ] as const) {
    for (const page of pages) {
      it(`${id} page ${page}: replies remain lossless in the current official mode`, async () => {
        const topic = await client.topics.getDetail(id, page)
        expect(['off', 'a', 'b', 'c', 'd', 'f', 'h']).toContain(topic.replyThreadStyle)
        expect(topic.replies.length).toBeGreaterThan(0)
        const floors = topic.replies.map(reply => Number(reply.floor))
        expect(floors).toEqual([...floors].sort((a, b) => a - b))
        expect(new Set(topic.replies.map(reply => reply.replyId)).size).toBe(topic.replies.length)
        const flattened = flattenReplyTree(buildReplyTree(topic.replies))
        expect(flattened).toHaveLength(topic.replies.length)
        expect(new Set(flattened.map(reply => reply.replyId)).size).toBe(topic.replies.length)
        if (topic.replyThreadStyle !== 'off' && id === 1257325 && page === 1) {
          expect(topic.replies.find(reply => reply.floor === '6')?.parent?.floor).toBe('2')
        }
        if (topic.replyThreadStyle === 'b' && id === 1257325 && page === 1) {
          expect(topic.replies.find(reply => reply.floor === '5')?.answeredBy).toContainEqual(
            expect.objectContaining({
              floor: '104',
              userName: 'panlista',
              url: '/t/1257325?p=2#r_18294823'
            })
          )
        }
        if (id === 1030787) expect(topic.replies.every(reply => !reply.parent)).toBe(true)
      })
    }
  }
})
