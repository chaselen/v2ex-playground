import { expect, it } from 'vitest'
import type { TopicReply } from '@extension/v2ex/types'
import { selectShareReplies } from './shareReplies'

function reply(floor: number, content = ''): TopicReply {
  return {
    replyId: String(floor),
    floor: String(floor),
    userName: `user${floor}`,
    userAvatar: '',
    isMod: false,
    isOp: false,
    isPro: false,
    time: '',
    repliedAt: '',
    content,
    thanks: 0,
    thanked: false
  }
}

const replies = [
  ...Array.from({ length: 6 }, (_, index) => reply(index + 1)),
  reply(9, '@user3 #3'),
  reply(13, '@user9 #9'),
  reply(14, '@user6 #6')
]

it('楼中楼保留所选顶层回复的全部后代，排除超出范围的顶层回复及其后代', () => {
  const selected = selectShareReplies(replies, 'nested', 5, text => text)
  expect(selected.map(reply => reply.floor)).toEqual(['1', '2', '3', '4', '5'])
  expect(selected[2].children[0].floor).toBe('9')
  expect(selected[2].children[0].children[0].floor).toBe('13')
})

it('普通列表仅保留指定楼层范围', () => {
  expect(selectShareReplies(replies, 'flat', 5).map(reply => reply.floor)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5'
  ])
})

it('支持空回复及第一页最大楼层', () => {
  expect(selectShareReplies([], 'nested', 5, text => text)).toEqual([])
  expect(selectShareReplies(replies, 'flat', 14)).toHaveLength(replies.length)
})
