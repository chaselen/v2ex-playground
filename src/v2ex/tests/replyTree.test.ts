import { describe, expect, it } from 'vitest'
import { load } from 'cheerio/slim'
import { buildReplyTree, type TopicReplyNode } from '../../../webview/src/topic/replyTree'
import type { TopicReply } from '../types'

/** 创建算法测试所需的最小完整回复数据 */
function reply(floor: number, userName: string, content = ''): TopicReply {
  return {
    replyId: String(floor),
    userAvatar: '',
    userName,
    time: '',
    repliedAt: '',
    floor: String(floor),
    content,
    thanks: 0,
    thanked: false
  }
}

/** 使用与 Webview 等价的 HTML 纯文本作为算法输入 */
function extractText(content: string): string {
  return load(content).text()
}

type FloorTree = Array<[string, FloorTree]>

/** 将回复树简化为便于断言的楼层结构 */
function floors(nodes: TopicReplyNode[]): FloorTree {
  return nodes.map(node => [node.floor, floors(node.children)])
}

describe('buildReplyTree', () => {
  it('使用用户名和楼层精确匹配父回复', () => {
    const tree = buildReplyTree(
      [reply(1, 'alice'), reply(2, 'bob'), reply(3, 'carol', '@alice #1 同意')],
      extractText
    )

    expect(floors(tree)).toEqual([
      ['1', [['3', []]]],
      ['2', []]
    ])
  })

  it('所有精确引用的优先级高于最近用户兜底', () => {
    const tree = buildReplyTree(
      [reply(1, 'alice'), reply(2, 'bob'), reply(3, 'carol', '@alice #1 @bob #999 精确引用应优先')],
      extractText
    )

    expect(floors(tree)).toEqual([
      ['1', [['3', []]]],
      ['2', []]
    ])
  })

  it('单个楼层号可以和多个被提及用户中的实际作者精确匹配', () => {
    const tree = buildReplyTree(
      [reply(1, 'alice'), reply(2, 'bob'), reply(3, 'carol', '@alice @bob #1 回复第一位用户')],
      extractText
    )

    expect(floors(tree)).toEqual([
      ['1', [['3', []]]],
      ['2', []]
    ])
  })

  it('没有楼层时匹配该用户最近的一条历史回复', () => {
    const tree = buildReplyTree(
      [reply(1, 'alice'), reply(2, 'alice'), reply(3, 'bob', '@alice 收到')],
      extractText
    )

    expect(floors(tree)).toEqual([
      ['1', []],
      ['2', [['3', []]]]
    ])
  })

  it('楼层作者不一致时回退到被提及用户的最近回复', () => {
    const tree = buildReplyTree(
      [reply(1, 'alice'), reply(2, 'bob'), reply(3, 'carol', '@alice #2 继续讨论')],
      extractText
    )

    expect(floors(tree)).toEqual([
      ['1', [['3', []]]],
      ['2', []]
    ])
  })

  it('多个模糊引用没有精确关系时保持顶层', () => {
    const tree = buildReplyTree(
      [reply(1, 'alice'), reply(2, 'bob'), reply(3, 'carol', '@alice @bob 回复后者')],
      extractText
    )

    expect(floors(tree)).toEqual([
      ['1', []],
      ['2', []],
      ['3', []]
    ])
  })

  it('递归形成多层回复树', () => {
    const tree = buildReplyTree(
      [reply(1, 'alice'), reply(2, 'bob', '@alice #1 提问'), reply(3, 'carol', '@bob #2 回答')],
      extractText
    )

    expect(floors(tree)).toEqual([['1', [['2', [['3', []]]]]]])
  })

  it('不会将回复挂到未来楼层', () => {
    const tree = buildReplyTree(
      [reply(1, 'bob', '@alice #2 提前引用'), reply(2, 'alice')],
      extractText
    )

    expect(floors(tree)).toEqual([
      ['1', []],
      ['2', []]
    ])
  })

  it('从回复 HTML 中提取用户名与楼层引用', () => {
    const tree = buildReplyTree(
      [
        reply(1, 'alice'),
        reply(2, 'bob', '@<a href="/member/alice">alice</a> <strong>#1</strong> 收到')
      ],
      extractText
    )

    expect(floors(tree)).toEqual([['1', [['2', []]]]])
  })
})
