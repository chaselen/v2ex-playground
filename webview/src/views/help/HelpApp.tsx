import { useEffect, useState, type MouseEvent } from 'react'
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

  /** 立即切换目录与加载占位，RPC 失败时保留重试入口 */
  async function loadPage(slug: string) {
    setState(previous => ({ ...previous, slug, status: 'loading', message: undefined }))
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

  /** 帮助页内锚点在当前正文中定位，先于共享链接导航处理 */
  function handleAnchorClick(event: MouseEvent<HTMLElement>) {
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    const href = anchor?.getAttribute('href') || ''
    if (!href.startsWith('#')) return
    const target = event.currentTarget.querySelector(`[id="${CSS.escape(href.slice(1))}"]`)
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    target.scrollIntoView({ block: 'start' })
  }

  return (
    <SimpleBar className="help-scroll" autoHide={false}>
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
        {!state.data && loading && <PageSkeleton variant="help" />}
        {!state.data && state.status === 'error' && (
          <HelpError message={state.message} onRetry={() => void loadPage(state.slug)} />
        )}
        {state.data && (
          <div className="help-layout">
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
        )}
      </main>
    </SimpleBar>
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
