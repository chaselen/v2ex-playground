import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Node } from '@/v2ex'
import { showAddCustomNodeQuickPick, showNodeQuickPick } from './nodeQuickPick'

/** VS Code QuickPick mock */
const vscodeMocks = vi.hoisted(() => ({
  showQuickPick: vi.fn()
}))

vi.mock('vscode', () => ({
  default: {
    window: {
      showQuickPick: vscodeMocks.showQuickPick
    }
  }
}))

/** QuickPick 测试节点 */
const nodes: Node[] = [
  { name: 'small', title: '小节点', collectCount: 20, topicCount: 8 },
  { name: 'large', title: '大节点', collectCount: 3, topicCount: 1200 },
  { name: 'middle', title: '中节点', collectCount: 10, topicCount: 60 }
]

describe('nodeQuickPick', () => {
  beforeEach(() => {
    vscodeMocks.showQuickPick.mockReset().mockResolvedValue(undefined)
  })

  test('sorts create-topic nodes by topic count and displays topic totals', () => {
    showNodeQuickPick(nodes, {
      title: '选择主题节点',
      placeHolder: '搜索节点',
      currentNodeName: 'middle',
      countField: 'topicCount',
      sortByCountDescending: true
    })

    const items = vscodeMocks.showQuickPick.mock.calls[0][0] as Array<{ label: string }>
    expect(items.map(item => item.label)).toEqual([
      '大节点 (large) · $(comment-discussion) 1,200',
      '$(check) 中节点 (middle) · $(comment-discussion) 60',
      '小节点 (small) · $(comment-discussion) 8'
    ])
  })

  test('keeps custom-node order and collection totals', () => {
    showAddCustomNodeQuickPick(nodes, new Set(['middle']))

    const items = vscodeMocks.showQuickPick.mock.calls[0][0] as Array<{ label: string }>
    expect(items.map(item => item.label)).toEqual([
      '小节点 (small) · $(bookmark) 20',
      '大节点 (large) · $(bookmark) 3',
      '$(check) 中节点 (middle) · $(bookmark) 10'
    ])
  })
})
