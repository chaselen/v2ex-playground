import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Banner, Button, Card, Empty } from '@douyinfe/semi-ui'
import { IconRefresh } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import PageSkeleton from '@/shared/PageSkeleton'
import { VscodeBadge } from '@/shared/SemiVscode'
import { createVsCodeClient, subscribeWebviewState } from '@/shared/vscode'
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
  function openMember(event: MouseEvent, username?: string) {
    event.stopPropagation()
    if (username) {
      vscode.openMember({ username })
    }
  }

  /** 打开节点 */
  function openNode(event: MouseEvent, topic: Topic) {
    event.stopPropagation()
    if (topic.node.name) {
      vscode.openNode(topic.node)
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
                icon={<IconRefresh />}
                theme="light"
                type="tertiary"
                onClick={() => void refresh()}
              >
                刷新
              </Button>
            </header>

            {state.status === 'error' && (
              <Banner
                className="tag-error"
                type="danger"
                title="刷新失败"
                description={state.message}
              />
            )}

            {data.list.length ? (
              <section className="tag-topic-list" aria-label={`${data.tag} 主题`}>
                {data.list.map(topic => (
                  <Card key={topic.id} className="tag-topic-card" bodyStyle={{ padding: 14 }}>
                    <div className="tag-topic-title-row">
                      <button type="button" onClick={() => openTopic(topic)}>
                        {topic.title}
                      </button>
                      {topic.replies > 0 && (
                        <VscodeBadge count={topic.replies} overflowCount={99} />
                      )}
                    </div>
                    <div className="tag-topic-meta">
                      {topic.node.title && (
                        <Button
                          className="tag-topic-node"
                          size="small"
                          type="tertiary"
                          onClick={event => openNode(event, topic)}
                        >
                          {topic.node.title}
                        </Button>
                      )}
                      {topic.authorName && (
                        <button
                          type="button"
                          className="tag-topic-member"
                          onClick={event => openMember(event, topic.authorName)}
                        >
                          {topic.authorName}
                        </button>
                      )}
                      {topic.displayTime && <span>{topic.displayTime}</span>}
                      {topic.lastReplyUser && <span>最后回复来自 {topic.lastReplyUser}</span>}
                    </div>
                  </Card>
                ))}
              </section>
            ) : (
              <Empty
                className="tag-empty"
                image={<IllustrationNoContent />}
                darkModeImage={<IllustrationNoContentDark />}
                title="暂无相关主题"
                description="这个标签下暂时没有可展示的主题"
              />
            )}
          </>
        )}

        {!loading && state.status === 'error' && !data && (
          <div className="tag-state">
            <Banner type="danger" title="加载失败" description={state.message} />
            <Button
              icon={<IconRefresh />}
              size="small"
              theme="light"
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
