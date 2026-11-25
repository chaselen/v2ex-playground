import { beforeEach, expect, test, vi } from 'vitest'
import { updateRecentBrowseTopic } from '@/features/recentBrowse'
import { setRemotePanelIcon } from '@/features/panelIcon'
import { TopicPanelController } from './TopicPanelController'
import { createV2exWebviewPanel } from './webviewPanel'

const mocks = vi.hoisted(() => ({
  postReply: vi.fn(),
  getDetail: vi.fn(),
  getCachedSummary: vi.fn(),
  post: vi.fn(),
  onDidChangeConfiguration: vi.fn(),
  onDidDispose: vi.fn()
}))
vi.mock('vscode', () => ({
  default: { workspace: { onDidChangeConfiguration: mocks.onDidChangeConfiguration } }
}))
vi.mock('@/global', () => ({
  default: {
    context: { globalState: { get: mocks.getCachedSummary } },
    V2ex: {
      topics: { postReply: mocks.postReply, getDetail: mocks.getDetail },
      hasLoginSession: () => true
    }
  }
}))
vi.mock('./webviewPanel', () => ({
  createV2exWebviewPanel: () => ({ webview: {}, onDidDispose: mocks.onDidDispose }),
  formatPanelTitle: (value: string) => value
}))
vi.mock('./WebviewCommonRpc', () => ({
  WebviewCommonRpc: class {
    bindBrowseSettings() {}
  }
}))
vi.mock('@/core/WebviewRpcBridge', () => ({
  WebviewRpcBridge: class {
    post = mocks.post
    dispose() {}
  }
}))
vi.mock('@/features/topicShareImage', () => ({
  getTopicShareImageCacheDir: () => '',
  TopicShareImageLoader: class {
    dispose() {}
  },
  saveTopicShareImage: vi.fn()
}))
vi.mock('@/features/recentBrowse', () => ({ updateRecentBrowseTopic: vi.fn() }))
vi.mock('@/features/panelIcon', () => ({ setRemotePanelIcon: vi.fn() }))
vi.mock('@/features/connectivityCheck', () => ({ checkImgurConnectivity: vi.fn() }))
vi.mock('@/core/imageUpload', () => ({ uploadImage: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.onDidChangeConfiguration.mockReturnValue({ dispose: vi.fn() })
  vi.mocked(updateRecentBrowseTopic).mockResolvedValue(undefined)
  vi.mocked(setRemotePanelIcon).mockResolvedValue(undefined)
  mocks.postReply.mockResolvedValue({ replyId: '123', replyPage: 2 })
  mocks.getDetail.mockResolvedValue({ id: 1, replyCurrentPage: 2, replies: [] })
})

function controller(onPageChanged?: (page: number, addEntry: boolean) => void) {
  return new TopicPanelController(
    1,
    undefined,
    {} as ConstructorParameters<typeof TopicPanelController>[2],
    createV2exWebviewPanel,
    onPageChanged
  )
}

test('notifies the topic webview when AI settings change and disposes the listener', () => {
  const dispose = vi.fn()
  mocks.onDidChangeConfiguration.mockReturnValue({ dispose })
  controller()
  const [onChange] = mocks.onDidChangeConfiguration.mock.calls[0]
  onChange({ affectsConfiguration: () => false })
  expect(mocks.post).not.toHaveBeenCalled()
  onChange({ affectsConfiguration: (section: string) => section === 'v2ex.ai' })
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('topicSummarySettingsChanged', {})
  const [onDispose] = mocks.onDidDispose.mock.calls[0]
  onDispose()
  expect(dispose).toHaveBeenCalledOnce()
})

test('includes cached summary availability when loading the topic', async () => {
  mocks.getCachedSummary.mockImplementation(key =>
    key === 'topicSummary:1' ? { text: '已有总结' } : undefined
  )
  const view = controller()

  await view.rpc_loadReplyPage(2)

  expect(view.rpc_ready()).toMatchObject({ status: 'topic', hasCachedSummary: true })
})

test('loads the page returned by successful publication, including when posting from a preview', async () => {
  const result = await controller().rpc_postTopicReply({
    topicId: 2,
    replyPage: 1,
    parentReplyId: '90',
    content: '正文'
  })
  expect(mocks.postReply).toHaveBeenCalledWith(2, '正文', { parentReplyId: '90', replyPage: 1 })
  expect(mocks.getDetail).toHaveBeenCalledWith(2, 2)
  expect(result).toMatchObject({
    posted: { replyId: '123', replyPage: 2 },
    topic: { replyCurrentPage: 2 }
  })
})

test('propagates refusal and does not refresh as if the reply had succeeded', async () => {
  mocks.postReply.mockRejectedValue(new Error('回复过于频繁'))
  await expect(controller().rpc_postTopicReply({ topicId: 1, content: '正文' })).rejects.toThrow(
    '回复过于频繁'
  )
  expect(mocks.getDetail).not.toHaveBeenCalled()
})

test('returns confirmed success separately when the subsequent refresh fails', async () => {
  mocks.getDetail.mockRejectedValue(new Error('网络中断'))
  await expect(controller().rpc_postTopicReply({ topicId: 1, content: '正文' })).resolves.toEqual({
    posted: { replyId: '123', replyPage: 2 },
    refreshError: '网络中断'
  })
  expect(mocks.postReply).toHaveBeenCalledTimes(1)
})

test('a main-panel publication moves to the returned reply page', async () => {
  const view = controller()
  mocks.getDetail.mockResolvedValueOnce({ id: 1, replyCurrentPage: 1, replies: [] })
  await view.rpc_loadReplyPage(1)
  await view.rpc_postTopicReply({ topicId: 1, replyPage: 1, content: '正文' })
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(2)
})

test('publication from a preview does not move the main panel even for the same topic', async () => {
  const view = controller()
  mocks.getDetail.mockResolvedValueOnce({ id: 1, replyCurrentPage: 1, replies: [] })
  await view.rpc_loadReplyPage(1)
  const result = await view.rpc_postTopicReply({
    topicId: 1,
    replyPage: 1,
    fromPreview: true,
    content: '正文'
  })
  expect(result.topic?.replyCurrentPage).toBe(2)
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(1)
})

test('a newer page navigation is not overwritten by an earlier publication', async () => {
  const view = controller()
  mocks.getDetail.mockResolvedValueOnce({ id: 1, replyCurrentPage: 1, replies: [] })
  await view.rpc_loadReplyPage(1)
  let complete!: (result: { replyId: string; replyPage: number }) => void
  mocks.postReply.mockReturnValueOnce(
    new Promise(resolve => {
      complete = resolve
    })
  )
  const posting = view.rpc_postTopicReply({ topicId: 1, replyPage: 1, content: '正文' })
  mocks.getDetail.mockResolvedValueOnce({ id: 1, replyCurrentPage: 3, replies: [] })
  await view.rpc_loadReplyPage(3)
  complete({ replyId: '123', replyPage: 2 })
  await expect(posting).resolves.toEqual({ posted: { replyId: '123', replyPage: 2 } })
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(3)
})

test('an in-flight navigation is not overwritten while its response is still pending', async () => {
  const view = controller()
  mocks.getDetail.mockResolvedValueOnce({ id: 1, replyCurrentPage: 1, replies: [] })
  await view.rpc_loadReplyPage(1)
  let finishPost!: (value: { replyId: string; replyPage: number }) => void
  let finishNavigation!: (value: unknown) => void
  mocks.postReply.mockReturnValueOnce(
    new Promise(resolve => {
      finishPost = resolve
    })
  )
  const posting = view.rpc_postTopicReply({ topicId: 1, replyPage: 1, content: '正文' })
  mocks.getDetail.mockReturnValueOnce(
    new Promise(resolve => {
      finishNavigation = resolve
    })
  )
  const navigating = view.rpc_loadReplyPage(3)
  mocks.post.mockClear()
  finishPost({ replyId: '123', replyPage: 2 })
  await posting
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(1)
  expect(mocks.post).not.toHaveBeenCalled()
  finishNavigation({ id: 1, replyCurrentPage: 3, replies: [] })
  await navigating
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(3)
})

test('refresh follows the pending reply page and ignores an older load', async () => {
  const detail = (replyCurrentPage: number) => ({
    id: 1,
    title: '话题',
    node: { name: '' },
    replyCurrentPage,
    replies: []
  })
  const onPageChanged = vi.fn()
  const view = controller(onPageChanged)
  mocks.getDetail.mockResolvedValueOnce(detail(2))
  await view.load(2)
  expect(onPageChanged).toHaveBeenLastCalledWith(2, false)
  onPageChanged.mockClear()

  let finishPaging!: (value: ReturnType<typeof detail>) => void
  mocks.getDetail
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishPaging = resolve
        })
    )
    .mockResolvedValueOnce(detail(3))
  const paging = view.rpc_loadReplyPage(3)
  await view.rpc_refresh()
  expect(mocks.getDetail).toHaveBeenLastCalledWith(1, 3)
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(3)

  finishPaging(detail(2))
  await expect(paging).resolves.toBeUndefined()
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(3)
  expect(onPageChanged).toHaveBeenCalledExactlyOnceWith(3, true)
})

test('a failed refresh does not replace a newer reply page', async () => {
  const view = controller()
  let failRefresh!: (error: Error) => void
  mocks.getDetail
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failRefresh = reject
        })
    )
    .mockResolvedValueOnce({ id: 1, replyCurrentPage: 3, replies: [] })
  const refreshing = view.rpc_refresh()
  await view.rpc_loadReplyPage(3)
  failRefresh(new Error('连接已断开'))

  await expect(refreshing).resolves.toBeUndefined()
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(3)
})

test('a delayed posted reply still confirms success after a toolbar refresh but cannot move the view', async () => {
  const detail = (replyCurrentPage: number) => ({
    id: 1,
    title: '话题',
    node: { name: '' },
    replyCurrentPage,
    replies: []
  })
  const view = controller()
  mocks.getDetail.mockResolvedValueOnce(detail(1))
  await view.rpc_loadReplyPage(1)

  let finishPostedDetail!: (value: ReturnType<typeof detail>) => void
  mocks.getDetail
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishPostedDetail = resolve
        })
    )
    .mockResolvedValueOnce(detail(1))
  const posting = view.rpc_postTopicReply({ topicId: 1, replyPage: 1, content: '正文' })
  await vi.waitFor(() => expect(mocks.getDetail).toHaveBeenCalledWith(1, 2))
  await view.rpc_refresh()
  finishPostedDetail(detail(2))

  await expect(posting).resolves.toEqual({ posted: { replyId: '123', replyPage: 2 } })
  expect(view.rpc_ready().topic?.replyCurrentPage).toBe(1)
})
