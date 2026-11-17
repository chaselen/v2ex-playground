import { expect, test } from 'vitest'
import { V2exClient } from '../client'
import { load } from 'cheerio/slim'

// 真实写入必须单独显式启用；普通 test / test:live 不发表回复
const topicId = Number(process.env.V2EX_REPLY_TEST_TOPIC_ID)
const parentId = process.env.V2EX_REPLY_TEST_PARENT_ID
test.skipIf(!process.env.V2EX_COOKIE || !topicId || !parentId)(
  'posts one explicitly enabled sandbox reply and verifies its official parent and returned location',
  async () => {
    const client = new V2exClient(process.env.V2EX_COOKIE)
    const before = await client.topics.getDetail(topicId)
    expect(before.node.name).toBe('sandbox')
    const parent = before.replies.find(reply => reply.replyId === parentId)
    expect(parent).toBeDefined()
    const content = `@${parent!.userName} [V2EX Playground 回归测试] 验证 parent_id、成功结果及新回复定位，请忽略。`
    // 已发表时允许仅重验读取断言，避免修复测试或网络重试造成重复写入
    const existingReplyId = process.env.V2EX_REPLY_TEST_EXISTING_REPLY_ID
    const posted = existingReplyId
      ? { replyId: existingReplyId, replyPage: 1 }
      : await client.topics.postReply(topicId, content, { parentReplyId: parentId, replyPage: 1 })
    expect(posted.replyId).toMatch(/^[1-9]\d*$/)
    const after = await client.topics.getDetail(topicId, posted.replyPage)
    const reply = after.replies.find(item => item.replyId === posted.replyId)
    expect(load(reply?.content || '').text()).toContain('验证 parent_id、成功结果及新回复定位')
    if (after.replyThreadStyle !== 'off') expect(reply?.parent?.replyId).toBe(parentId)
  }
)
