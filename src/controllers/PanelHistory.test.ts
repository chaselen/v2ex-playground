import { beforeEach, expect, test, vi } from 'vitest'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import type { WebviewRequestMessage } from '@/shared/webviewRpc'
import { PanelHistory } from './PanelHistory'
import type { CreateWebviewContentPanel } from './webviewPanel'

vi.mock('vscode', () => ({
  default: {
    EventEmitter: class {
      private listeners = new Set<(value: unknown) => void>()
      event = (listener: (value: unknown) => void) => {
        this.listeners.add(listener)
        return { dispose: () => this.listeners.delete(listener) }
      }
      fire(value: unknown) {
        this.listeners.forEach(listener => listener(value))
      }
      dispose() {
        this.listeners.clear()
      }
    }
  }
}))
vi.mock('@/core/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('vscode-tint/vscode', () => ({}))

const createPanel = vi.hoisted(() => vi.fn())
vi.mock('./webviewPanel', () => ({
  createV2exWebviewPanel: createPanel,
  formatPanelTitle: (title: string) => title
}))

function mockPanel() {
  const listeners = new Set<(message: WebviewRequestMessage) => void>()
  let close = () => {}
  let show = (_event: { webviewPanel: { visible: boolean } }) => {}
  return {
    title: '',
    iconPath: undefined,
    reveal: vi.fn(),
    show: () => show({ webviewPanel: { visible: true } }),
    onDidChangeViewState: (listener: typeof show) => {
      show = listener
    },
    close: () => {
      close()
    },
    onDidDispose: (listener: () => void) => {
      close = listener
    },
    receive: (message: WebviewRequestMessage) => {
      for (const listener of [...listeners]) listener(message)
    },
    webview: {
      asWebviewUri: (value: unknown) => value,
      postMessage: vi.fn().mockResolvedValue(true),
      onDidReceiveMessage(listener: (message: WebviewRequestMessage) => void) {
        listeners.add(listener)
        return { dispose: () => listeners.delete(listener) }
      }
    }
  }
}

class Content {
  constructor(
    readonly panel: ReturnType<CreateWebviewContentPanel>,
    public page = 1
  ) {}
}

beforeEach(() => createPanel.mockReset())

function open(history: PanelHistory<Content>, key: string) {
  history.open(
    `https://www.v2ex.com/t/${key}`,
    (create, page) =>
      new Content(create({ title: key, htmlEntry: 'topic.html', viewType: 'topic' }), page)
  )
}

test('reuses one tab and restores the page for each history entry', () => {
  const panel = mockPanel()
  createPanel.mockReturnValue(panel)
  const history = new PanelHistory<Content>()
  open(history, 'A')
  history.updatePage(history.current!, 'https://www.v2ex.com/t/A?p=3', 3, false)
  open(history, 'B')
  expect(history.current!.page).toBe(1)
  const b = history.rpc_historyReady()
  expect(b.url).toBe('https://www.v2ex.com/t/B')
  open(history, 'B')
  expect(history.rpc_historyReady()).toEqual(b)
  expect(createPanel).toHaveBeenCalledOnce()

  history.rpc_traverseHistory(b.activationId, 'back')
  expect(history.current!.page).toBe(3)
  expect(panel.title).toBe('A')
  expect(history.rpc_historyReady()).toMatchObject({
    url: 'https://www.v2ex.com/t/A?p=3',
    canGoBack: false,
    canGoForward: true
  })
  history.rpc_traverseHistory(b.activationId, 'forward')
  expect(panel.title).toBe('A')
  history.rpc_traverseHistory(history.rpc_historyReady().activationId, 'forward')
  expect(panel.title).toBe('B')
  expect(history.rpc_historyReady().url).toBe('https://www.v2ex.com/t/B')
  history.rpc_traverseHistory(history.rpc_historyReady().activationId, 'back')
  open(history, 'C')
  expect(history.rpc_historyReady()).toMatchObject({ canGoBack: true, canGoForward: false })

  panel.close()
  createPanel.mockReturnValue(mockPanel())
  open(history, 'A')
  expect(history.current!.page).toBe(1)
  expect(history.rpc_historyReady()).toMatchObject({ canGoBack: false, canGoForward: false })
  expect(createPanel).toHaveBeenCalledTimes(2)
})

test('isolates late messages and title updates while completing writes on the original target', async () => {
  const panel = mockPanel()
  createPanel.mockReturnValue(panel)
  const history = new PanelHistory<Content>()
  let finish: (value: string) => void = () => {}
  const write = vi.fn(
    () =>
      new Promise<string>(resolve => {
        finish = resolve
      })
  )
  const openWithRpc = (key: string) =>
    history.open(`https://www.v2ex.com/t/${key}`, create => {
      const scoped = create({ title: key, htmlEntry: 'topic.html', viewType: 'topic' })
      const rpc = new WebviewRpcBridge(scoped.webview, { rpc_write: write })
      scoped.onDidDispose(() => rpc.dispose())
      return new Content(scoped)
    })
  openWithRpc('A')
  const old = history.current!.panel
  const panelActivationId = history.rpc_historyReady().activationId
  panel.receive({ command: 'write', requestId: 'started', args: [], panelActivationId })
  openWithRpc('B')

  old.title = 'stale title'
  await old.webview.postMessage({ command: 'stale event' })
  panel.receive({ command: 'write', requestId: 'queued', args: [], panelActivationId })
  finish('A')
  await vi.waitFor(() =>
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'started', ok: true, data: 'A' })
    )
  )
  expect(write).toHaveBeenCalledOnce()
  expect(panel.title).toBe('B')
  expect(panel.webview.postMessage).not.toHaveBeenCalledWith({ command: 'stale event' })
  expect(panel.webview.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ requestId: 'queued', ok: false })
  )
})

test('resends the latest history state when a hidden tab becomes visible', () => {
  const panel = mockPanel()
  createPanel.mockReturnValue(panel)
  const history = new PanelHistory<Content>()
  open(history, 'A')
  open(history, 'B')
  panel.webview.postMessage.mockClear()

  panel.show()
  expect(panel.webview.postMessage).toHaveBeenCalledWith({
    command: 'panelHistoryChanged',
    state: history.rpc_historyReady()
  })
})

test('records same-controller pagination and restores each page in the same tab', () => {
  const panel = mockPanel()
  createPanel.mockReturnValue(panel)
  const history = new PanelHistory<Content>()
  open(history, 'A')
  const initial = history.rpc_historyReady()
  const current = history.current!
  const page2 = 'https://www.v2ex.com/t/A?p=2'
  const page3 = 'https://www.v2ex.com/t/A?p=3'

  history.updatePage(current, page2, 2, true)
  const second = history.rpc_historyReady()
  expect(second).toMatchObject({ url: page2, activationId: initial.activationId, canGoBack: true })
  expect(second.entryId).not.toBe(initial.entryId)
  expect(history.current).toBe(current)

  history.updatePage(current, page2, 2, true)
  expect(history.rpc_historyReady()).toEqual(second)
  history.rpc_traverseHistory(second.activationId, 'back')
  const back = history.rpc_historyReady()
  expect(back).toMatchObject({ entryId: initial.entryId, url: initial.url, canGoForward: true })
  expect(history.current?.page).toBe(1)

  history.updatePage(current, page3, 3, true)
  expect(history.rpc_historyReady()).toEqual(back)
  history.rpc_traverseHistory(back.activationId, 'forward')
  expect(history.rpc_historyReady()).toMatchObject({ entryId: second.entryId, url: page2 })
  expect(history.current?.page).toBe(2)

  history.rpc_traverseHistory(history.rpc_historyReady().activationId, 'back')
  history.updatePage(history.current!, page3, 3, true)
  expect(history.rpc_historyReady()).toMatchObject({ url: page3, canGoForward: false })
  expect(createPanel).toHaveBeenCalledOnce()
})
