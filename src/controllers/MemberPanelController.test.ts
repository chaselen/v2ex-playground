import { beforeEach, expect, test, vi } from 'vitest'
import { MemberPanelController } from './MemberPanelController'

const mocks = vi.hoisted(() => ({
  getInfo: vi.fn(),
  getContent: vi.fn(),
  getIgnoredNodeCount: vi.fn(),
  getFollowingMembers: vi.fn(),
  getBlockedMembersAndIgnoredTopicIds: vi.fn(),
  clearIgnoredNodes: vi.fn(),
  clearIgnoredTopics: vi.fn(),
  getByIds: vi.fn()
}))
vi.mock('@/global', () => ({
  default: {
    V2ex: {
      hasLoginSession: () => true,
      getAuthenticatedUsername: () => 'tester',
      ensureAuthenticated: async () => true,
      members: { getInfo: mocks.getInfo, getContent: mocks.getContent },
      account: {
        getIgnoredNodeCount: mocks.getIgnoredNodeCount,
        getFollowingMembers: mocks.getFollowingMembers,
        getBlockedMembersAndIgnoredTopicIds: mocks.getBlockedMembersAndIgnoredTopicIds,
        clearIgnoredNodes: mocks.clearIgnoredNodes,
        clearIgnoredTopics: mocks.clearIgnoredTopics
      },
      topics: { getByIds: mocks.getByIds }
    }
  }
}))
vi.mock('./webviewPanel', () => ({
  createV2exWebviewPanel: () => ({ webview: {}, onDidDispose() {}, title: '' }),
  formatPanelTitle: (title: string) => title
}))
vi.mock('./WebviewCommonController', () => ({ WebviewCommonController: class {} }))
vi.mock('@/core/WebviewRpcBridge', () => ({
  WebviewRpcBridge: class {
    post() {}
  }
}))
vi.mock('@/core/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/features/panelIcon', () => ({ setRemotePanelIcon: async () => {} }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getInfo.mockResolvedValue({ username: 'tester', avatar: '' })
  mocks.getContent.mockResolvedValue({
    tab: 'topics',
    page: 1,
    topics: [],
    replies: [],
    totalCount: 0,
    totalPage: 1,
    hidden: false,
    message: ''
  })
  mocks.getFollowingMembers.mockResolvedValue([])
  mocks.getBlockedMembersAndIgnoredTopicIds.mockResolvedValue({
    blockedMembers: [],
    ignoredTopicIds: [123]
  })
  mocks.getIgnoredNodeCount.mockResolvedValue(2)
  mocks.getByIds.mockImplementation(async (ids: number[]) => ids.map(id => ({ id })))
})

function createController() {
  return new MemberPanelController(
    'tester',
    {} as ConstructorParameters<typeof MemberPanelController>[1]
  )
}

test('节点数量读取失败仍展示资料，数量保持未知而不是零', async () => {
  mocks.getIgnoredNodeCount.mockRejectedValue(new Error('网络失败'))
  const controller = createController()
  await controller.load()
  expect(controller.rpc_ready()).toMatchObject({
    status: 'member',
    isSelf: true,
    profile: { member: { username: 'tester' }, ignoredTopicIds: [123] }
  })
  expect(controller.rpc_ready().profile?.ignoredNodeCount).toBeUndefined()
})

test('清除节点失败保留原计数，成功后同步为零', async () => {
  const controller = createController()
  await controller.load()
  mocks.clearIgnoredNodes.mockRejectedValueOnce(new Error('清除失败'))
  await expect(controller.rpc_clearIgnoredNodes()).rejects.toThrow('清除失败')
  expect(controller.rpc_ready().profile?.ignoredNodeCount).toBe(2)
  const profile = await controller.rpc_clearIgnoredNodes()
  expect(profile.ignoredNodeCount).toBe(0)
  expect(controller.rpc_ready().profile?.ignoredNodeCount).toBe(0)
  expect(mocks.getIgnoredNodeCount).toHaveBeenCalledTimes(1)
})

test('清除忽略主题同步清空当前分页内容与总数，保留节点计数', async () => {
  const controller = createController()
  await controller.load()
  await controller.rpc_loadMemberTab('ignored')
  const profile = await controller.rpc_clearIgnoredTopics()
  expect(profile).toMatchObject({
    ignoredNodeCount: 2,
    ignoredTopicIds: [],
    content: { tab: 'ignored', page: 1, topics: [], totalCount: 0 }
  })
})
