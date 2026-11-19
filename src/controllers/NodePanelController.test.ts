import { expect, test, vi } from 'vitest'
import type { NodeTopicList } from '@/v2ex'
import { NodePanelController } from './NodePanelController'
import { createV2exWebviewPanel } from './webviewPanel'

const getTopics = vi.hoisted(() => vi.fn())
vi.mock('vscode', () => ({ default: {} }))
vi.mock('@/global', () => ({
  default: { V2ex: { nodes: { getTopics }, hasLoginSession: () => false } }
}))
vi.mock('./webviewPanel', () => ({
  createV2exWebviewPanel: () => ({ webview: {}, onDidDispose() {} }),
  formatPanelTitle: (value: string) => value
}))
vi.mock('./WebviewCommonRpc', () => ({
  WebviewCommonRpc: class {
    bindBrowseSettings() {}
  }
}))
vi.mock('@/core/WebviewRpcBridge', () => ({
  WebviewRpcBridge: class {
    post() {}
  }
}))
vi.mock('@/features/panelIcon', () => ({ setRemotePanelIcon: vi.fn(async () => undefined) }))
vi.mock('@/features/nodeCollection', () => ({ notifyCollectionNodesChanged: vi.fn() }))

const list: NodeTopicList = {
  node: { name: 'vscode', title: 'VS Code' },
  totalCount: 30,
  totalPage: 3,
  list: []
}

test.each(['success', 'failure'])(
  'a stale node refresh (%s) leaves the newer page visible',
  async outcome => {
    getTopics.mockReset()
    const onPageChanged = vi.fn()
    const panel = new NodePanelController(
      'vscode',
      'VS Code',
      {} as ConstructorParameters<typeof NodePanelController>[2],
      createV2exWebviewPanel,
      onPageChanged
    )
    let finishRefresh!: () => void
    getTopics
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finishRefresh = () =>
              outcome === 'success' ? resolve(list) : reject(new Error('连接已断开'))
          })
      )
      .mockResolvedValueOnce(list)

    const refreshing = panel.rpc_refresh()
    await panel.rpc_loadPage(2)
    finishRefresh()
    await expect(refreshing).resolves.toBeUndefined()
    expect(panel.rpc_ready()).toMatchObject({ status: 'result', data: { page: 2 } })
    expect(onPageChanged).toHaveBeenCalledExactlyOnceWith(2, true)
  }
)
