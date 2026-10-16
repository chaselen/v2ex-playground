import { beforeEach, expect, test, vi } from 'vitest'
import { HelpPanelController } from './HelpPanelController'
import type { HelpPage } from '@/v2ex'

const mocks = vi.hoisted(() => ({ getPage: vi.fn(), post: vi.fn(), openExternal: vi.fn() }))
vi.mock('@/global', () => ({
  default: { V2ex: { baseUrl: 'https://www.v2ex.com', help: { getPage: mocks.getPage } } }
}))
vi.mock('./webviewPanel', () => ({
  createV2exWebviewPanel: () => ({ webview: {}, onDidDispose() {}, reveal() {}, title: '' }),
  formatPanelTitle: (title: string) => title
}))
vi.mock('./WebviewCommonController', () => ({ WebviewCommonController: class {} }))
vi.mock('@/core/WebviewRpcBridge', () => ({
  WebviewRpcBridge: class {
    post = mocks.post
    dispose() {}
  }
}))
vi.mock('@/features/openExternal', () => ({ openExternal: mocks.openExternal }))

const currency: HelpPage = {
  slug: 'currency',
  title: '虚拟货币系统',
  navigation: [],
  html: '<h2 id="boost">Boost</h2>'
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getPage.mockResolvedValue(currency)
})

function createController() {
  return new HelpPanelController({} as ConstructorParameters<typeof HelpPanelController>[0])
}

test('navigates to an anchor in cached help without fetching the article again', async () => {
  const controller = createController()
  await controller.load('currency')
  await controller.load('currency', false, 'boost')
  expect(controller.rpc_ready()).toMatchObject({
    status: 'result',
    slug: 'currency',
    anchor: 'boost'
  })
  expect(mocks.getPage).toHaveBeenCalledTimes(1)
  const posts = mocks.post.mock.calls.length
  await controller.load('currency', false, 'boost')
  expect(mocks.post).toHaveBeenCalledTimes(posts + 1)
  expect(mocks.getPage).toHaveBeenCalledTimes(1)
})

test('preserves the section when refreshing or opening the original document', async () => {
  const controller = createController()
  await controller.load('currency', false, 'boost')
  await controller.rpc_refresh()
  expect(controller.rpc_ready().anchor).toBe('boost')
  expect(mocks.getPage).toHaveBeenCalledTimes(2)
  controller.rpc_openSource()
  expect(mocks.openExternal).toHaveBeenCalledWith('https://www.v2ex.com/help/currency#boost')
})

test('does not let an older request replace the latest document and section', async () => {
  let finishOlder!: (page: HelpPage) => void
  mocks.getPage.mockImplementationOnce(
    () =>
      new Promise<HelpPage>(resolve => {
        finishOlder = resolve
      })
  )
  const controller = createController()
  const older = controller.load('home', false, 'old-section')
  await controller.load('currency', false, 'boost')
  finishOlder({ ...currency, slug: 'home' })
  await older
  expect(controller.rpc_ready()).toMatchObject({ slug: 'currency', anchor: 'boost' })
})
