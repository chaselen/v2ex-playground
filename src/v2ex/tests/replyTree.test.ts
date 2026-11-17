import { expect, it } from 'vitest'
import {
  buildReplyTree,
  flattenReplyTree,
  flattenReplyGroup,
  getReplyLineLayout
} from '../../../webview/src/views/topic/replyTree'
import type { TopicReply } from '../types'

function reply(floor: number, parent?: number): TopicReply {
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
    thanks: 0,
    thanked: false,
    content: '@user1 #1',
    ...(parent
      ? {
          parent: {
            replyId: String(parent),
            userName: `user${parent}`,
            floor: String(parent),
            url: `#r_${parent}`,
            content: ''
          }
        }
      : {})
  }
}

it('只按官方父回复编号构树，不再从 @用户名与楼层推断', () => {
  const tree = buildReplyTree([reply(1), reply(2), reply(3, 1), reply(4, 3)])
  expect(tree.map(node => node.floor)).toEqual(['1', '2'])
  expect(tree[0].children[0].children[0].floor).toBe('4')
  expect(flattenReplyTree(tree)).toHaveLength(4)
})

it('乱序输入恢复楼层顺序，跨页、未来目标、自引用均保持顶层且无环', () => {
  const input = [reply(105, 20), reply(103, 104), reply(101, 101), reply(104, 103), reply(102)]
  const tree = buildReplyTree(input)
  expect(tree.map(node => node.floor)).toEqual(['101', '102', '103', '105'])
  expect(tree[2].children[0].floor).toBe('104')
  expect(new Set(flattenReplyTree(tree).map(node => node.replyId)).size).toBe(5)
})

it('连续对话复用连线颜色，交叉对话分配独立轨道，跨页不连线', () => {
  const input = [reply(1), reply(2), reply(3, 1), reply(4, 2), reply(5, 3), reply(6, 99)]
  const { stations, segments } = getReplyLineLayout(input)
  expect(stations.map(station => station.row).sort()).toEqual([0, 1, 2, 3, 4])
  expect(segments).toHaveLength(2)
  expect(segments[0].rows).toEqual([0, 2, 4])
  expect(segments[0].lane).not.toBe(segments[1].lane)
})
it('楼中楼组内按楼层排序，树形保留分支的深度优先顺序', () => {
  const nodes = buildReplyTree([reply(1), reply(2, 1), reply(3, 1), reply(4, 2)])
  expect(flattenReplyTree(nodes[0].children).map(r => r.floor)).toEqual(['2', '4', '3'])
  expect(flattenReplyGroup(nodes[0].children).map(r => r.floor)).toEqual(['2', '3', '4'])
})
it('同一讨论的分支只占一条轨道，并保留非连续父回复的跳转信息', () => {
  const layout = getReplyLineLayout([reply(1), reply(2, 1), reply(3, 1), reply(4, 2)])
  expect(layout.segments).toHaveLength(1)
  expect(layout.segments[0].rows).toEqual([0, 1, 2, 3])
  expect(layout.stations.find(s => s.row === 3)?.previous).toBe(2)
  expect(layout.parents[3]).toBe(1)
})
it('轨道拥挤时暂停下次回复最远的讨论并以同色续接，不丢弃任何站点', () => {
  const input = [reply(1), reply(2), reply(3), reply(4, 3), reply(5, 2), reply(6, 1)]
  const layout = getReplyLineLayout(input, 2)
  expect(layout.stations.map(s => s.row).sort()).toEqual([0, 1, 2, 3, 4, 5])
  const paused = layout.segments.find(s => s.rows.includes(0))!
  const resumed = layout.segments.find(s => s.rows.includes(5))!
  expect(paused.cutBelow).toBe(true)
  expect(resumed.cutAbove).toBe(true)
  expect(paused.conversation).toBe(resumed.conversation)
  expect(paused.color).toBe(resumed.color)
  expect(layout.segments.every(s => s.lane < 2)).toBe(true)
})
it('没有本页讨论时不分配轨道，异常关联不会形成环', () => {
  expect(getReplyLineLayout([reply(1, 2), reply(2, 2), reply(3, 99)]).stations).toEqual([])
  expect(getReplyLineLayout([]).segments).toEqual([])
})
it('跨页父回复的本页子树仍可连线，但根回复保留跨页引用入口', () => {
  const layout = getReplyLineLayout([reply(101, 99), reply(102, 101)])
  expect(layout.stations.map(s => s.row)).toEqual([0, 1])
  expect(layout.parents).toEqual([-1, 0])
})

it('官网默认五轨在六段交错讨论中仍保留所有站点', () => {
  const input = [
    ...Array.from({ length: 6 }, (_, index) => reply(index + 1)),
    ...Array.from({ length: 6 }, (_, index) => reply(index + 7, index + 1))
  ]
  const layout = getReplyLineLayout(input)
  expect(layout.stations.map(station => station.row).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 12 }, (_, index) => index)
  )
  expect(Math.max(...layout.segments.map(segment => segment.lane))).toBe(4)
  expect(layout.segments.some(segment => segment.cutBelow)).toBe(true)
  expect(layout.segments.some(segment => segment.cutAbove)).toBe(true)
})
