import { useEffect, useRef, useState } from 'react'
import { Bookmark, BookmarkPlus, Inbox, RefreshCw } from 'lucide-react'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import PageSkeleton from '@/components/PageSkeleton'
import TopicListItem from '@/components/TopicListItem'
import { Alert, Avatar, Button, Empty, Pagination, Toast } from '@/components/ui'
import { createVsCodeClient, subscribeWebviewState } from '@/core/vscode'
import type { Topic } from '@extension/v2ex/types'
import type {
  NodePanelRpcCommands,
  NodePanelViewState,
  NodePanelWebviewEvents
} from '@extension/shared/webview'

/** 节点主题面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<NodePanelRpcCommands, NodePanelWebviewEvents>()

/** 节点主题页面应用 */
export default function NodeApp() {
  const [state, setState] = useState<NodePanelViewState>({ status: 'loading', loggedIn: false })
  const [collecting, setCollecting] = useState(false)
  const scrollRef = useRef<SimpleBarCore | null>(null)
  const data = state.data
  const loading = state.status === 'loading'
  const node = data?.node
  const isCollected = !!node?.isCollected
  const canCollect = state.loggedIn

  useEffect(() => {
    return subscribeWebviewState(
      handler => vscode.on('nodeStateChanged', event => handler(event.state)),
      () => vscode.ready(),
      setState,
      err =>
        setState({
          status: 'error',
          loggedIn: false,
          message: (err as Error).message || '节点主题加载失败'
        })
    )
  }, [])

  /** 刷新当前页主题列表 */
  async function refresh() {
    try {
      await vscode.refresh()
      scrollRef.current?.getScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // 扩展侧已同步错误状态
    }
  }

  /**
   * 加载指定页主题列表
   * @param page 页码
   */
  async function loadPage(page: number) {
    try {
      await vscode.loadPage(page)
      scrollRef.current?.getScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // 扩展侧已同步错误状态
    }
  }

  /** 收藏或取消收藏当前节点 */
  async function toggleCollect() {
    if (collecting) {
      return
    }

    setCollecting(true)
    try {
      if (isCollected) {
        await vscode.cancelCollectNode()
        Toast.success('已取消收藏节点')
      } else {
        await vscode.collectNode()
        Toast.success('已收藏节点')
      }
    } catch (err) {
      Toast.error((err as Error).message || (isCollected ? '取消收藏节点失败' : '收藏节点失败'))
    } finally {
      setCollecting(false)
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
  function openNode(nodePayload: Topic['node']) {
    if (nodePayload.name) {
      vscode.openNode(nodePayload)
    }
  }

  /** 主题数与收藏人数摘要 */
  const summaryParts = [
    `共 ${data?.totalCount.toLocaleString() || 0} 个主题`,
    typeof node?.collectCount === 'number' ? `${node.collectCount.toLocaleString()} 人收藏` : null
  ].filter(Boolean)

  return (
    <SimpleBar ref={scrollRef} className="node-scroll" role="main" autoHide={false}>
      <main className="node-container">
        {loading && !data && <PageSkeleton variant="node-topics" rows={6} />}

        {data && (
          <>
            <header className="node-header">
              <div className="node-header-main">
                <Avatar
                  className="node-avatar"
                  src={node?.avatar}
                  alt={node?.title || ''}
                  size="large"
                  shape="square"
                />
                <div className="node-header-text">
                  <span className="node-eyebrow">节点</span>
                  <h1>{node?.title || '节点'}</h1>
                  {!!node?.description && <p className="node-description">{node.description}</p>}
                  <p className="node-count">{summaryParts.join(' · ')}</p>
                </div>
              </div>
              <div className="node-header-actions">
                {canCollect && (
                  <Button
                    aria-label={isCollected ? '取消收藏节点' : '收藏节点'}
                    icon={
                      isCollected ? (
                        <Bookmark aria-hidden="true" fill="currentColor" />
                      ) : (
                        <BookmarkPlus aria-hidden="true" />
                      )
                    }
                    variant="subtle"
                    loading={collecting}
                    disabled={loading}
                    onClick={() => void toggleCollect()}
                  >
                    {isCollected ? '取消收藏' : '加入收藏'}
                  </Button>
                )}
                <Button
                  aria-label="刷新节点主题"
                  icon={<RefreshCw aria-hidden="true" />}
                  variant="ghost"
                  loading={loading}
                  onClick={() => void refresh()}
                >
                  刷新
                </Button>
              </div>
            </header>

            {state.status === 'error' && (
              <Alert
                className="node-error"
                variant="danger"
                title="刷新失败"
                description={state.message}
              />
            )}

            {data.list.length ? (
              <>
                <section className="node-topic-list" aria-label={`${node?.title || '节点'} 主题`}>
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
                <Pagination
                  className="node-pagination"
                  page={data.page}
                  totalPages={data.totalPage}
                  showQuickJumper
                  hideOnSinglePage
                  disabled={loading || collecting}
                  onPageChange={page => void loadPage(page)}
                />
              </>
            ) : (
              <Empty
                className="node-empty"
                icon={<Inbox />}
                title="暂无主题"
                description="这个节点下暂时没有可展示的主题"
              />
            )}
          </>
        )}

        {!loading && state.status === 'error' && !data && (
          <div className="node-state">
            <Alert variant="danger" title="加载失败" description={state.message} />
            <Button
              className="node-retry"
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
