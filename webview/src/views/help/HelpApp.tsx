import { getLinkMenuItems } from '@/components/linkMenuItems'
import { usePanelScrollPosition } from '@/components/PanelAddressBar'
import PageContextMenu from '@/components/PageContextMenu'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { BookOpen, ChevronRight, ExternalLink } from 'lucide-react'
import EnhancedHtmlContent from '@/components/EnhancedHtmlContent'
import PageSkeleton from '@/components/PageSkeleton'
import { ScrollArea, Alert, Button, Toast } from '@/components/ui'
import { createVsCodeClient, resolveWebviewUrl, subscribeWebviewState } from '@/core/vscode'
import type { HelpRpcCommands, HelpViewState, HelpWebviewEvents } from '@extension/shared/webview'

const vscode = createVsCodeClient<HelpRpcCommands, HelpWebviewEvents>()

/** 动态帮助目录与正文 */
export default function HelpApp() {
  const [state, setState] = useState<HelpViewState>({ status: 'loading', slug: 'home' })
  const contentRootRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const { onScroll, hasSavedPosition } = usePanelScrollPosition(
    contentScrollRef,
    state.status === 'result'
  )
  const positioned = useRef(false)
  const loading = state.status === 'loading'
  const sourceUrl = new URL(resolveWebviewUrl(`/help/${state.slug}`))
  if (state.anchor) sourceUrl.hash = encodeURIComponent(state.anchor)
  const pageUrl = sourceUrl.toString()
  useEffect(
    () =>
      subscribeWebviewState(
        handler => vscode.on('helpStateChanged', event => handler(event.state)),
        () => vscode.ready(),
        setState,
        error => setState({ status: 'error', slug: 'home', message: String(error) })
      ),
    []
  )

  useLayoutEffect(() => {
    if (state.status !== 'result') return
    const restoring = !positioned.current && hasSavedPosition
    positioned.current = true
    if (restoring) return
    contentScrollRef.current?.scrollTo({ top: 0, left: 0 })
    if (!state.anchor) return
    const target = contentRootRef.current?.querySelector(
      `.help-content [id="${CSS.escape(state.anchor)}"]`
    )
    if (target) scrollToAnchor(target)
  }, [hasSavedPosition, state])

  /** 目录导航与失败重试共用扩展侧路由 */
  async function loadPage(slug: string) {
    try {
      if (state.slug === slug) {
        if (state.status === 'error') await vscode.refresh()
      } else {
        await vscode.load(slug)
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '帮助内容加载失败')
    }
  }

  /** 仅滚动正文，避免锚点定位同时带动外层布局和目录 */
  function scrollToAnchor(target: Element) {
    const scroll = contentScrollRef.current
    if (!scroll) return
    const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0
    scroll.scrollTo({
      top:
        scroll.scrollTop +
        target.getBoundingClientRect().top -
        scroll.getBoundingClientRect().top -
        margin
    })
  }

  /** 帮助页内锚点在当前正文中定位，先于共享链接导航处理 */
  function handleAnchorClick(event: MouseEvent<HTMLElement>) {
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    const href = anchor?.getAttribute('href') || ''
    if (!href.startsWith('#')) return
    let id: string
    try {
      id = decodeURIComponent(href.slice(1))
    } catch {
      return
    }
    const target = event.currentTarget.querySelector(`[id="${CSS.escape(id)}"]`)
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    void vscode.load(state.slug, id).catch(error => {
      Toast.error(error instanceof Error ? error.message : '帮助章节加载失败')
    })
  }

  return (
    <PageContextMenu items={getLinkMenuItems(pageUrl)}>
      <main className="help-container" aria-busy={loading}>
        <header className="help-toolbar">
          <div className="help-brand">
            <span className="help-brand-icon">
              <BookOpen aria-hidden="true" />
            </span>
            <div>
              <strong>站点帮助</strong>
              <span className="help-subtitle">了解 V2EX 的功能与社区规则</span>
            </div>
          </div>
          <Button
            variant="ghost"
            icon={<ExternalLink aria-hidden="true" />}
            onClick={() => void vscode.openSource()}
          >
            查看原文
          </Button>
        </header>
        {!state.data && (
          <ScrollArea className="help-initial-scroll">
            {loading ? (
              <PageSkeleton variant="help" />
            ) : (
              <HelpError message={state.message} onRetry={() => void loadPage(state.slug)} />
            )}
          </ScrollArea>
        )}
        {state.data && (
          <div className="help-layout">
            <ScrollArea
              className="help-nav-scroll"
              viewportProps={{ role: 'region', 'aria-label': '帮助目录' }}
            >
              <nav className="help-nav" aria-label="帮助主题">
                {state.data.navigation.map(item => (
                  <Button
                    key={item.slug}
                    variant={item.slug === state.slug ? 'subtle' : 'ghost'}
                    aria-current={item.slug === state.slug ? 'page' : undefined}
                    onClick={() => void loadPage(item.slug)}
                  >
                    <span>{item.title}</span>
                    <ChevronRight className="help-nav-chevron" aria-hidden="true" />
                  </Button>
                ))}
              </nav>
            </ScrollArea>
            <ScrollArea
              className="help-content-scroll"
              viewportRef={contentScrollRef}
              viewportProps={{
                role: 'region',
                'aria-label': '帮助正文',
                onScroll
              }}
            >
              <div ref={contentRootRef}>
                {loading ? (
                  <PageSkeleton variant="help-content" />
                ) : state.status === 'error' ? (
                  <HelpError message={state.message} onRetry={() => void loadPage(state.slug)} />
                ) : (
                  <EnhancedHtmlContent
                    onClickCapture={handleAnchorClick}
                    key={state.data.slug}
                    className="help-content topic-content"
                    html={state.data.html}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </main>
    </PageContextMenu>
  )
}

/** 当前帮助主题的加载错误与重试入口 */
function HelpError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="help-error">
      <Alert variant="danger" title="帮助内容加载失败" description={message} />
      <Button onClick={onRetry}>重试</Button>
    </div>
  )
}
