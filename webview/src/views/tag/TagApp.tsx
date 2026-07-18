import { useEffect, useRef, useState } from 'react'
import { Inbox, RefreshCw } from 'lucide-react'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import PageSkeleton from '@/components/PageSkeleton'
import TopicListItem from '@/components/TopicListItem'
import { Alert, Button, Empty } from '@/components/ui'
import { createVsCodeClient, subscribeWebviewState } from '@/core/vscode'
import type { Topic } from '@extension/v2ex/types'
import type {
  TagPanelRpcCommands,
  TagPanelViewState,
  TagPanelWebviewEvents
} from '@extension/shared/webview'

/** 标签主题面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<TagPanelRpcCommands, TagPanelWebviewEvents>()

/** 标签主题页面应用 */
export default function TagApp() {
  const [state, setState] = useState<TagPanelViewState>({ status: 'loading' })
  const scrollRef = useRef<SimpleBarCore | null>(null)
  const data = state.data
  const loading = state.status === 'loading'

  useEffect(() => {
    return subscribeWebviewState(
      handler => vscode.on('tagStateChanged', event => handler(event.state)),
      () => vscode.ready(),
      setState,
      err => setState({ status: 'error', message: (err as Error).message || '标签主题加载失败' })
    )
  }, [])

  /** 刷新标签主题列表 */
  async function refresh() {
    try {
      await vscode.refresh()
      scrollRef.current?.getScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // 扩展侧已同步错误状态
    }
  }

  /** 打开话题 */
  function openTopic(topic: Topic) {
    vscode.openTopic({ topicId: topic.id, title: topic.title })
  }

  /** 打开作者 */
  function openMember(username?: string) {
    if (username) {
      vscode.openMember(username)
    }
  }

  /** 打开节点 */
  function openNode(node: Topic['node']) {
    if (node.name) {
      vscode.openNode(node)
    }
  }

  return (
    <SimpleBar ref={scrollRef} className="tag-scroll" role="main" autoHide={false}>
      <main className="tag-container">
        {loading && <PageSkeleton variant="tag-topics" rows={6} />}

        {!loading && data && (
          <>
            <header className="tag-header">
              <div>
                <span className="tag-eyebrow">帖子标签</span>
                <h1>{data.tag}</h1>
                <p>共 {data.totalCount} 个主题</p>
              </div>
              <Button
                aria-label="刷新标签主题"
                icon={<RefreshCw aria-hidden="true" />}
                variant="ghost"
                onClick={() => void refresh()}
              >
                刷新
              </Button>
            </header>

            {state.status === 'error' && (
              <Alert
                className="tag-error"
                variant="danger"
                title="刷新失败"
                description={state.message}
              />
            )}

            {data.list.length ? (
              <section className="tag-topic-list" aria-label={`${data.tag} 主题`}>
                {data.list.map(topic => (
                  <TopicListItem
                    key={topic.id}
                    topic={topic}
                    appearance="card"
                    showAuthor
                    onOpenTopic={openTopic}
                    onOpenMember={openMember}
                    onOpenNode={openNode}
                  />
                ))}
              </section>
            ) : (
              <Empty
                className="tag-empty"
                icon={<Inbox />}
                title="暂无相关主题"
                description="这个标签下暂时没有可展示的主题"
              />
            )}
          </>
        )}

        {!loading && state.status === 'error' && !data && (
          <div className="tag-state">
            <Alert variant="danger" title="加载失败" description={state.message} />
            <Button
              className="tag-retry"
              icon={<RefreshCw aria-hidden="true" />}
              size="small"
              onClick={() => void refresh()}
            >
              重试
            </Button>
          </div>
        )}
      </main>
    </SimpleBar>
  )
}
