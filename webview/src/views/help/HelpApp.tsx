import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { BookOpen, ChevronRight, ExternalLink } from 'lucide-react'
import SimpleBar from 'simplebar-react'
import EnhancedHtmlContent from '@/components/EnhancedHtmlContent'
import PageSkeleton from '@/components/PageSkeleton'
import { Alert, Button } from '@/components/ui'
import { createVsCodeClient, subscribeWebviewState } from '@/core/vscode'
import type { HelpRpcCommands, HelpViewState, HelpWebviewEvents } from '@extension/shared/webview'

const vscode = createVsCodeClient<HelpRpcCommands, HelpWebviewEvents>()

/** 动态帮助目录与正文 */
export default function HelpApp() {
  const [state, setState] = useState<HelpViewState>({ status: 'loading', slug: 'home' })
  const contentRootRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLElement>(null)
  const loading = state.status === 'loading'
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

  useEffect(() => {
    if (state.status !== 'result') return
    contentScrollRef.current?.scrollTo({ top: 0, left: 0 })
    if (!state.anchor) return
    const target = contentRootRef.current?.querySelector(
      `.help-content [id="${CSS.escape(state.anchor)}"]`
    )
    if (target) scrollToAnchor(target)
  }, [state])

  /** 立即切换目录与加载占位，RPC 失败时保留重试入口 */
  async function loadPage(slug: string) {
    if (state.slug === slug && state.status !== 'error') return
    setState(previous => ({
      ...previous,
      slug,
      anchor: undefined,
      status: 'loading',
      message: undefined
    }))
    try {
      await vscode.load(slug)
    } catch (error) {
      setState(previous =>
        previous.slug === slug
          ? {
              ...previous,
              status: 'error',
              message: error instanceof Error ? error.message : '帮助内容加载失败'
            }
          : previous
      )
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
    const target = event.currentTarget.querySelector(`[id="${CSS.escape(href.slice(1))}"]`)
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    scrollToAnchor(target)
  }

  return (
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
        <SimpleBar className="help-initial-scroll" autoHide={false}>
          {loading ? (
            <PageSkeleton variant="help" />
          ) : (
            <HelpError message={state.message} onRetry={() => void loadPage(state.slug)} />
          )}
        </SimpleBar>
      )}
      {state.data && (
        <div className="help-layout">
          <SimpleBar
            className="help-nav-scroll"
            autoHide={false}
            scrollableNodeProps={{ role: 'region', 'aria-label': '帮助目录' }}
          >
            <nav className="help-nav" aria-label="帮助主题">
              <span className="help-nav-label">帮助目录</span>
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
          </SimpleBar>
          <SimpleBar
            className="help-content-scroll"
            autoHide={false}
            scrollableNodeProps={{
              ref: contentScrollRef,
              role: 'region',
              'aria-label': '帮助正文'
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
          </SimpleBar>
        </div>
      )}
    </main>
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
