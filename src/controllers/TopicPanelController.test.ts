import { beforeEach, expect, test, vi } from 'vitest'
import { TopicPanelController } from './TopicPanelController'

const mocks = vi.hoisted(() => ({ postReply: vi.fn(), getDetail: vi.fn(), post: vi.fn() }))
vi.mock('vscode', () => ({ default: {} }))
vi.mock('@/global', () => ({
  default: {
    V2ex: {
      topics: { postReply: mocks.postReply, getDetail: mocks.getDetail },
      hasLoginSession: () => true
    }
  }
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
    post = mocks.post
  }
}))
vi.mock('@/features/topicShareImage', () => ({
  getTopicShareImageCacheDir: () => '',
  TopicShareImageLoader: class {},
  saveTopicShareImage: vi.fn()
}))
vi.mock('@/features/recentBrowse', () => ({ updateRecentBrowseTopic: vi.fn() }))
vi.mock('@/features/panelIcon', () => ({ setRemotePanelIcon: vi.fn() }))
vi.mock('@/features/connectivityCheck', () => ({ checkImgurConnectivity: vi.fn() }))
vi.mock('@/core/imageUpload', () => ({ uploadImage: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.postReply.mockResolvedValue({ replyId: '123', replyPage: 2 })
  mocks.getDetail.mockResolvedValue({ id: 1, replyCurrentPage: 2, replies: [] })
})

function controller() {
  return new TopicPanelController(
    1,
    undefined,
    {} as ConstructorParameters<typeof TopicPanelController>[2]
  )
}

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
  await posting
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
