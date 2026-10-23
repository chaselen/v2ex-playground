import { expect, test, vi } from 'vitest'
import type { BrowseSettings } from '@/shared/browseSettings'
import { WebviewCommonRpc } from './WebviewCommonRpc'

const mocks = vi.hoisted(() => ({
  listeners: new Set<() => void>(),
  settings: {
    openInNewTab: true,
    autoSignIn: true,
    showImagesInTopic: true,
    showAvatar: true
  }
}))

vi.mock('@/config', () => ({
  default: {
    getBrowseSettings: () => mocks.settings,
    onDidChange: (listener: () => void) => {
      mocks.listeners.add(listener)
      return { dispose: () => mocks.listeners.delete(listener) }
    }
  }
}))
vi.mock('@/features/imageDownload', () => ({ downloadImage: vi.fn() }))
vi.mock('vscode-tint/vscode', () => ({ getSyntaxTheme: vi.fn() }))

/** 创建可主动销毁的视图，验证不同视图的设置订阅相互独立 */
function createView() {
  let disposeListener = () => {}
  const view = {
    onDidDispose: (listener: () => void) => {
      disposeListener = listener
      return { dispose() {} }
    }
  }
  return { view, dispose: () => disposeListener() }
}

test('浏览设置推送绑定到各自视图，销毁一个视图不影响另一个', () => {
  const controller = new WebviewCommonRpc({
    openExternal: vi.fn(),
    openMember: vi.fn(),
    openTopic: vi.fn(),
    openNode: vi.fn()
  })
  const first = createView()
  const second = createView()
  const firstPost = vi.fn()
  const secondPost = vi.fn()
  controller.bindBrowseSettings(first.view, { post: firstPost })
  controller.bindBrowseSettings(second.view, { post: secondPost })

  const settings: BrowseSettings = { ...mocks.settings, showAvatar: false }
  mocks.settings = settings
  mocks.listeners.forEach(listener => listener())
  expect(controller.rpc_getBrowseSettings()).toEqual(settings)
  expect(firstPost).toHaveBeenLastCalledWith('browseSettingsChanged', { settings })
  expect(secondPost).toHaveBeenLastCalledWith('browseSettingsChanged', { settings })

  first.dispose()
  mocks.settings = { ...settings, showImagesInTopic: false }
  mocks.listeners.forEach(listener => listener())
  expect(firstPost).toHaveBeenCalledTimes(1)
  expect(secondPost).toHaveBeenCalledTimes(2)
  expect(secondPost).toHaveBeenLastCalledWith('browseSettingsChanged', { settings: mocks.settings })

  second.dispose()
  expect(mocks.listeners.size).toBe(0)
})
