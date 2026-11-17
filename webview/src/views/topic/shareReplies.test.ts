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
    ...(floor === 9 || floor === 13 || floor === 14
      ? {
          parent: {
            replyId: String(floor === 9 ? 3 : floor === 13 ? 9 : 6),
            userName: '',
            floor: '',
            url: '',
            content: ''
          }
        }
      : {}),
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
  const selected = selectShareReplies(replies, 'c', 5)
  expect(selected.map(reply => reply.floor)).toEqual(['1', '2', '3', '4', '5', '9', '13'])
})

it('普通列表仅保留指定楼层范围', () => {
  expect(selectShareReplies(replies, 'off', 5).map(reply => reply.floor)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5'
  ])
})

it('支持空回复及第一页最大楼层', () => {
  expect(selectShareReplies([], 'd', 5)).toEqual([])
  expect(selectShareReplies(replies, 'off', 14)).toHaveLength(replies.length)
})
