import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type UIEvent
} from 'react'
import { ArrowLeft, ArrowRight, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { createVsCodeClient, setPanelActivationId, subscribeWebviewState } from '@/core/vscode'
import type {
  PanelHistoryRpcCommands,
  PanelHistoryState,
  PanelHistoryWebviewEvents
} from '@extension/shared/panelHistory'
import type { WebviewCommonRpcCommands } from '@extension/shared/commonView'
import { Button, Input, Toast } from './ui'
import styles from './PanelAddressBar.module.scss'

const vscode = createVsCodeClient<
  PanelHistoryRpcCommands &
    Pick<WebviewCommonRpcCommands, 'copyText' | 'openInBrowser'> & { refresh(): void },
  PanelHistoryWebviewEvents
>()
interface PanelReadingPosition {
  scroll?: { top: number; contentKey?: string }
}

const PanelContentContext = createContext<
  { position: PanelReadingPosition; url: string } | undefined
>(undefined)

/** 在顶部地址栏显示当前目标和历史操作，并为每次目标切换重建内容状态 */
export default function PanelAddressBar({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PanelHistoryState>()
  const [refreshingActivation, setRefreshingActivation] = useState<number>()
  const positions = useRef(new Map<number, PanelReadingPosition>())
  useEffect(
    () =>
      subscribeWebviewState(
        handler => vscode.on('panelHistoryChanged', event => handler(event.state)),
        () => vscode.historyReady(),
        setState
      ),
    []
  )

  useLayoutEffect(() => {
    if (state) setPanelActivationId(state.activationId)
  }, [state])

  if (!state) return null
  const url = state.url

  let position = positions.current.get(state.entryId)
  if (!position) {
    position = {}
    positions.current.set(state.entryId, position)
  }

  function traverse(direction: 'back' | 'forward') {
    if (!state) return
    void vscode.traverseHistory(state.activationId, direction).catch(error => {
      Toast.error(error instanceof Error ? error.message : '页面切换失败')
    })
  }

  async function refresh(activationId: number) {
    setRefreshingActivation(activationId)
    try {
      await vscode.refresh()
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '刷新页面失败')
    } finally {
      setRefreshingActivation(current => (current === activationId ? undefined : current))
    }
  }

  async function copyAddress(url: string) {
    try {
      await vscode.copyText(url)
      Toast.success('已复制链接')
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '复制链接失败')
    }
  }

  function openAddress(url: string) {
    void vscode.openInBrowser(url).catch(error => {
      Toast.error(error instanceof Error ? error.message : '打开链接失败')
    })
  }

  return (
    <div className={styles.panel}>
      <nav className={styles.toolbar} aria-label="页面导航">
        <Button
          className={styles.action}
          size="small"
          compact
          variant="ghost"
          disabled={!state.canGoBack}
          aria-label="后退"
          title="后退"
          icon={<ArrowLeft aria-hidden="true" />}
          onClick={() => traverse('back')}
        />
        <Button
          className={styles.action}
          size="small"
          compact
          variant="ghost"
          disabled={!state.canGoForward}
          aria-label="前进"
          title="前进"
          icon={<ArrowRight aria-hidden="true" />}
          onClick={() => traverse('forward')}
        />
        <Button
          className={styles.action}
          size="small"
          compact
          variant="ghost"
          loading={refreshingActivation === state.activationId}
          focusableWhenDisabled
          aria-label="刷新页面"
          title="刷新页面"
          icon={<RefreshCw aria-hidden="true" />}
          onClick={() => void refresh(state.activationId)}
        />
        <Input
          className={styles.address}
          size="small"
          aria-label="当前页面链接"
          title={url}
          value={url}
          readOnly
          onFocus={event => event.currentTarget.select()}
        />
        <Button
          className={styles.action}
          size="small"
          compact
          variant="ghost"
          aria-label="复制链接"
          title="复制链接"
          icon={<Copy aria-hidden="true" />}
          onClick={() => void copyAddress(url)}
        />
        <Button
          className={styles.action}
          size="small"
          compact
          variant="ghost"
          aria-label="在浏览器中打开"
          title="在浏览器中打开"
          icon={<ExternalLink aria-hidden="true" />}
          onClick={() => openAddress(url)}
        />
      </nav>
      <div className={styles.content}>
        <PanelContentContext.Provider key={state.activationId} value={{ position, url }}>
          {children}
        </PanelContentContext.Provider>
      </div>
    </div>
  )
}

/** 恢复已加载内容的滚动位置，可按分段和页码区分不同的内容 */
export function usePanelScrollPosition(
  viewport: RefObject<HTMLDivElement | null>,
  ready: boolean,
  { contentKey, pageUrl }: { contentKey?: string; pageUrl?: string } = {}
) {
  const context = useContext(PanelContentContext)
  const position = context?.position
  // 翻页时历史事件与内容事件可能分开到达，只记录同一页的滚动
  const canTrack = ready && (!pageUrl || context?.url === pageUrl)
  const initialEntry = useRef(position).current
  const initialScroll = useRef(position?.scroll).current
  const savedTop =
    position === initialEntry && initialScroll?.contentKey === contentKey
      ? initialScroll?.top
      : undefined
  const restored = useRef(false)

  useLayoutEffect(() => {
    if (!canTrack || !viewport.current) return
    if (position?.scroll && position.scroll.contentKey !== contentKey) {
      position.scroll = undefined
    }
    if (restored.current) {
      if (pageUrl && position && position !== initialEntry && !position.scroll) {
        position.scroll = { top: viewport.current.scrollTop, contentKey }
      }
      return
    }
    if (savedTop !== undefined) {
      viewport.current.scrollTop = savedTop
    }
    restored.current = true
  }, [canTrack, viewport, position, contentKey, initialEntry, pageUrl, savedTop])

  return {
    hasSavedPosition: savedTop !== undefined,
    onScroll(event: UIEvent<HTMLDivElement>) {
      if (position && canTrack && restored.current) {
        position.scroll = { top: event.currentTarget.scrollTop, contentKey }
      }
    }
  }
}
