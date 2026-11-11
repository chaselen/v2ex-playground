import { getLinkMenuItems } from '@/components/linkMenuItems'
import PageContextMenu from '@/components/PageContextMenu'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileJson,
  Inbox,
  RefreshCw,
  Rss,
  SquarePen
} from 'lucide-react'
import PageSkeleton from '@/components/PageSkeleton'
import NodeButton from '@/components/NodeButton'
import TopicListItem from '@/components/TopicListItem'
import {
  ScrollArea,
  Alert,
  Avatar,
  Button,
  ConfirmPopover,
  Empty,
  Pagination,
  Toast,
  Tooltip
} from '@/components/ui'
import { createVsCodeClient, resolveWebviewUrl, subscribeWebviewState } from '@/core/vscode'
import type { Node, Topic } from '@extension/v2ex/types'
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
  const [ignoring, setIgnoring] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const data = state.data
  const loading = state.status === 'loading'
  const node = data?.node
  const pageUrl = node?.name
    ? resolveWebviewUrl(`/go/${node.name}?p=${data?.page ?? 1}`)
    : undefined
  const isCollected = !!node?.isCollected
  const canCollect = state.loggedIn
  const relatedNodes = data?.relatedNodes ?? []
  const childNodes = data?.childNodes ?? []

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
    if (collecting || ignoring) return
    try {
      await vscode.refresh()
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // 扩展侧已同步错误状态
    }
  }

  /**
   * 加载指定页主题列表
   * @param page 页码
   */
  async function loadPage(page: number) {
    if (loading || collecting || ignoring) return
    try {
      await vscode.loadPage(page)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // 扩展侧已同步错误状态
    }
  }

  /** 收藏或取消收藏当前节点 */
  async function toggleCollect() {
    if (loading || collecting || ignoring) {
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

  /** 切换节点忽略状态 */
  async function toggleIgnored() {
    if (collecting || ignoring || loading) return
    setIgnoring(true)
    try {
      const nextState = node?.isIgnored
        ? await vscode.cancelIgnoreNode()
        : await vscode.ignoreNode()
      setState(nextState)
      Toast.success(node?.isIgnored ? '已取消忽略节点' : '已忽略节点')
    } catch (err) {
      Toast.error((err as Error).message || '更新节点忽略状态失败')
    } finally {
      setIgnoring(false)
    }
  }

  /** 复制当前节点的订阅地址 */
  async function copySubscription(format: 'xml' | 'json') {
    if (!node?.name) return
    const label = format === 'xml' ? 'RSS' : 'JSON Feed'
    try {
      await vscode.copySubscription(format)
      Toast.success(`已复制 ${label} 订阅地址`)
    } catch {
      Toast.error(`复制 ${label} 订阅地址失败，请重试`)
    }
  }

  /** 打开话题 */
  function openTopic(topic: Topic) {
    vscode.openTopic(topic.id, topic.title)
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
      vscode.openNode(nodePayload.name, nodePayload.title)
    }
  }

  return (
    <PageContextMenu items={getLinkMenuItems(pageUrl)}>
      <ScrollArea fillViewport viewportRef={scrollRef} className="node-scroll" role="main">
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
                    <div className="node-heading">
                      <h1>{node?.title || '节点'}</h1>
                      <div className="node-count">
                        <span className="node-count-summary">
                          共 <strong>{data.totalCount.toLocaleString()}</strong> 个主题
                          {typeof node?.collectCount === 'number' && (
                            <> · {node.collectCount.toLocaleString()} 人收藏</>
                          )}
                        </span>
                        <div className="node-subscriptions" role="group" aria-label="订阅节点">
                          <Tooltip content="复制 RSS 订阅地址">
                            <Button
                              size="small"
                              compact
                              aria-label="复制 RSS 订阅地址"
                              icon={<Rss aria-hidden="true" />}
                              variant="ghost"
                              disabled={!node?.name}
                              onClick={() => void copySubscription('xml')}
                            />
                          </Tooltip>
                          <Tooltip content="复制 JSON Feed 订阅地址">
                            <Button
                              size="small"
                              compact
                              aria-label="复制 JSON Feed 订阅地址"
                              icon={<FileJson aria-hidden="true" />}
                              variant="ghost"
                              disabled={!node?.name}
                              onClick={() => void copySubscription('json')}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                    {!!node?.description && <p className="node-description">{node.description}</p>}
                  </div>
                </div>
                <div className="node-header-actions">
                  {state.loggedIn && (
                    <Button
                      className="node-create-topic"
                      size="small"
                      aria-label={`在${node?.title || '当前节点'}创建新主题`}
                      icon={<SquarePen aria-hidden="true" />}
                      variant="primary"
                      disabled={loading || ignoring}
                      onClick={() => void vscode.createTopic()}
                    >
                      创建新主题
                    </Button>
                  )}
                  {canCollect && (
                    <Button
                      size="small"
                      aria-label={isCollected ? '取消收藏节点' : '收藏节点'}
                      icon={
                        isCollected ? (
                          <Bookmark aria-hidden="true" fill="currentColor" />
                        ) : (
                          <BookmarkPlus aria-hidden="true" />
                        )
                      }
                      variant="secondary"
                      loading={collecting}
                      disabled={loading || ignoring}
                      onClick={() => void toggleCollect()}
                    >
                      {isCollected ? '取消收藏' : '加入收藏'}
                    </Button>
                  )}
                  {state.loggedIn && typeof node?.isIgnored === 'boolean' && (
                    <ConfirmPopover
                      title={node.isIgnored ? '取消忽略这个节点？' : '忽略这个节点？'}
                      description={
                        node.isIgnored
                          ? '该节点的内容将重新出现在首页及热议列表中'
                          : '该节点的内容将不再出现在首页及热议列表中'
                      }
                      disabled={loading || collecting || ignoring}
                      danger={!node.isIgnored}
                      onConfirm={toggleIgnored}
                    >
                      <Button
                        size="small"
                        variant={node.isIgnored ? 'secondary' : 'danger'}
                        loading={ignoring}
                        icon={
                          node.isIgnored ? (
                            <Eye aria-hidden="true" />
                          ) : (
                            <EyeOff aria-hidden="true" />
                          )
                        }
                      >
                        {node.isIgnored ? '取消忽略节点' : '忽略节点'}
                      </Button>
                    </ConfirmPopover>
                  )}
                  <Button
                    size="small"
                    aria-label="刷新节点主题"
                    icon={<RefreshCw aria-hidden="true" />}
                    variant="ghost"
                    loading={loading}
                    disabled={collecting || ignoring}
                    onClick={() => void refresh()}
                  >
                    刷新
                  </Button>
                </div>
              </header>

              {(data.parentNode || childNodes.length > 0 || relatedNodes.length > 0) && (
                <nav className="node-relations" aria-label="节点导航">
                  {data.parentNode && (
                    <div className="node-relation-row">
                      <span className="node-relation-label">父节点</span>
                      <NodeButton
                        icon={
                          data.parentNode.avatar && (
                            <img
                              className="node-relation-avatar"
                              src={data.parentNode.avatar}
                              alt=""
                              width={16}
                              height={16}
                              loading="lazy"
                              decoding="async"
                            />
                          )
                        }
                        onClick={() => openNode(data.parentNode!)}
                      >
                        {data.parentNode.title}
                      </NodeButton>
                    </div>
                  )}
                  <NodeRelationList
                    key={`${node?.name}-children`}
                    label="子节点"
                    id="node-child-links"
                    nodes={childNodes}
                    onOpen={openNode}
                  />
                  <NodeRelationList
                    key={`${node?.name}-related`}
                    label="相关节点"
                    id="node-related-links"
                    nodes={relatedNodes}
                    onOpen={openNode}
                  />
                </nav>
              )}

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
                        withAuthorAvatar
                        showNode={false}
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
                    disabled={loading || collecting || ignoring}
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
      </ScrollArea>
    </PageContextMenu>
  )
}

/** 节点关系列表独立控制展开，能单行容纳时直接展示全部节点 */
function NodeRelationList({
  label,
  id,
  nodes,
  onOpen
}: {
  label: string
  id: string
  nodes: Node[]
  onOpen: (node: Node) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(nodes.length)
  const linksRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const toggleMeasureRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const links = linksRef.current
    const measure = measureRef.current
    const toggle = toggleMeasureRef.current
    if (!links || !measure || !toggle) return
    const update = () => {
      const available = links.clientWidth
      const gap = Number.parseFloat(getComputedStyle(links).columnGap) || 0
      const widths = Array.from(measure.children, element => element.getBoundingClientRect().width)
      const fullWidth =
        widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap
      if (fullWidth <= available) {
        setVisibleCount(nodes.length)
        return
      }
      // 以最大剩余数量预留按钮宽度，数字等宽保证实际文案不会超出预留空间
      let used = toggle.getBoundingClientRect().width
      let count = 0
      for (const width of widths) {
        if (used + gap + width > available) break
        used += gap + width
        count++
      }
      setVisibleCount(count)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(links)
    observer.observe(measure)
    observer.observe(toggle)
    return () => observer.disconnect()
  }, [nodes])

  if (!nodes.length) return null
  return (
    <div className="node-relation-row">
      <span className="node-relation-label">{label}</span>
      <div className="node-relation-links" id={id} ref={linksRef}>
        {/* 测量完整列表的自然宽度；不挂载图片，避免加载折叠部分的图标 */}
        <div className="node-relation-measure-clip" aria-hidden="true" inert>
          <div className="node-relation-measure" ref={measureRef}>
            {nodes.map(related => (
              <NodeButton
                key={related.name}
                tabIndex={-1}
                icon={related.avatar && <span className="node-relation-avatar" />}
              >
                {related.title}
              </NodeButton>
            ))}
          </div>
          <Button
            ref={toggleMeasureRef}
            className="node-relation-toggle"
            size="small"
            variant="ghost"
            tabIndex={-1}
            icon={<ChevronDown aria-hidden="true" />}
          >
            {`展开其余 ${nodes.length} 个`}
          </Button>
        </div>
        {(expanded ? nodes : nodes.slice(0, visibleCount)).map(related => (
          <NodeButton
            key={related.name}
            icon={
              related.avatar && (
                <img
                  className="node-relation-avatar"
                  src={related.avatar}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  decoding="async"
                />
              )
            }
            onClick={() => onOpen(related)}
          >
            {related.title}
          </NodeButton>
        ))}
        {visibleCount < nodes.length && (
          <Button
            className="node-relation-toggle"
            size="small"
            variant="ghost"
            icon={expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? '收起' : `展开其余 ${nodes.length - visibleCount} 个`}
          </Button>
        )}
      </div>
    </div>
  )
}
