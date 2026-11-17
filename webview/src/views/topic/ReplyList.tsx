import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { ChevronRight, Minus, Plus } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  HoverCard,
  Spinner,
  Toast
} from '@/components/ui'
import EnhancedHtmlContent from '@/components/EnhancedHtmlContent'
import { getTopicReplyTarget } from '@/core/topicLink'
import { resolveWebviewUrl } from '@/core/vscode'
import type { OpenTopicPreview } from '@/core/contentEnhancement'
import type { ReplyThreadStyle, TopicReply, TopicReplyReference } from '@extension/v2ex/types'
import {
  buildReplyTree,
  flattenReplyTree,
  flattenReplyGroup,
  getReplyLineLayout,
  type TopicReplyNode
} from './replyTree'
import './replyThreads.scss'
import { getReplyVerticalGeometry } from './replyGeometry'
import { getReplyDisplayContent } from './replyContent'

/** 单条回复内容中可插入的官方关联 */
export interface ReplyDecorations {
  /** 已按当前模式处理开头父回复提及的正文 HTML */
  content: string
  before?: ReactNode
  beforeTime?: ReactNode
  meta?: ReactNode
  after?: ReactNode
}

interface ReplyListProps {
  replies: TopicReply[]
  style: ReplyThreadStyle
  topicId: number
  showImages?: boolean
  /** 隐藏头像时仍为树形连线保留紧凑的独立区域 */
  showAvatar?: boolean
  onTopicPreview?: OpenTopicPreview
  onLoadPage?: (page: number) => Promise<void>
  /** 成功发表后定位并展开新回复 */
  locateReplyId?: string
  renderReply(reply: TopicReply, decorations: ReplyDecorations): ReactNode
  /** 分享图使用已缓存的图片替换引用正文中的远程资源 */
  transformHtml?: (html: string) => string
  /** 分享图默认展开全部内容，不包含操作控件 */
  static?: boolean
}

/** 七种官网布局共用的回复列表；话题页、预览和分享图使用相同关系与展示规则 */
export default function ReplyList({
  replies,
  style,
  topicId,
  showImages = true,
  showAvatar = true,
  onTopicPreview,
  onLoadPage,
  locateReplyId,
  renderReply,
  transformHtml = html => html,
  static: isStatic = false
}: ReplyListProps) {
  const container = useRef<HTMLDivElement>(null)
  const navigationRequest = useRef(0)
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  const [pendingTarget, setPendingTarget] = useState<string>()
  const [loadingTarget, setLoadingTarget] = useState(false)
  const [highlightedReply, setHighlightedReply] = useState<string>()
  const tree = useMemo(
    () => (style === 'c' || style === 'd' ? buildReplyTree(replies) : []),
    [replies, style]
  )
  const byId = useMemo(() => new Map(replies.map(reply => [reply.replyId, reply])), [replies])
  const answeredReferences = useMemo(() => {
    const groups = new Map<string, Map<string, TopicReplyReference>>()
    if (style !== 'b') return new Map<string, TopicReplyReference[]>()
    for (const reply of replies) {
      const targets = new Map<string, TopicReplyReference>()
      for (const target of reply.answeredBy || []) {
        const local = byId.get(target.replyId)
        targets.set(target.replyId, local ? reference(local) : target)
      }
      groups.set(reply.replyId, targets)
    }
    for (const reply of replies) {
      const targets = groups.get(reply.parent?.replyId || '')
      targets?.set(reply.replyId, reference(reply))
    }
    return new Map(
      [...groups].map(([id, targets]) => [
        id,
        [...targets.values()].sort((a, b) => Number(a.floor) - Number(b.floor))
      ])
    )
  }, [replies, style, byId])
  const layout = useMemo(() => getReplyLineLayout(style === 'f' ? replies : []), [replies, style])
  const [hoveredReply, setHoveredReply] = useState<string>()
  const [pinnedReply, setPinnedReply] = useState<string>()
  const maskId = useId().replace(/:/g, '')
  const lined = new Set(layout.stations.map(station => replies[station.row].replyId))
  const focusRow = replies.findIndex(reply => reply.replyId === (pinnedReply || hoveredReply))
  const focusConversation = layout.stations.find(station => station.row === focusRow)?.conversation
  const [points, setPoints] = useState<{ y: number }[]>([])

  useEffect(() => {
    if (
      pinnedReply &&
      !layout.stations.some(station => replies[station.row].replyId === pinnedReply)
    )
      setPinnedReply(undefined)
  }, [layout, replies, pinnedReply])

  function toggleLinePin(replyId: string) {
    setHoveredReply(undefined)
    setPinnedReply(current => (current === replyId ? undefined : replyId))
  }

  useEffect(() => {
    setFolded(new Set())
    setPinnedReply(undefined)
    setHoveredReply(undefined)
  }, [topicId, style])
  useEffect(() => {
    if (locateReplyId) setPendingTarget(locateReplyId)
  }, [locateReplyId])
  useEffect(() => {
    if (!highlightedReply) return
    const timer = window.setTimeout(() => setHighlightedReply(undefined), 2000)
    return () => window.clearTimeout(timer)
  }, [highlightedReply])
  useEffect(() => {
    if (!pendingTarget) return
    if (!byId.has(pendingTarget)) {
      if (!loadingTarget) {
        setPendingTarget(undefined)
        Toast.warning('目标回复不可见或已被删除')
      }
      return
    }
    const ancestors = new Set<string>()
    let reply = byId.get(pendingTarget)
    while (reply?.parent && !ancestors.has(reply.parent.replyId)) {
      ancestors.add(reply.parent.replyId)
      reply = byId.get(reply.parent.replyId)
    }
    setFolded(current => new Set([...current].filter(id => !ancestors.has(id))))
    let canceled = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(async () => {
        // 折叠面板完成展开后再定位，避免焦点落在仍被隐藏的后代上
        const animations =
          container.current
            ?.getAnimations({ subtree: true })
            .filter(animation => animation.effect?.getTiming().iterations !== Infinity) || []
        await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)))
        if (canceled) return
        const target = container.current?.querySelector<HTMLElement>(
          `[data-thread-reply="${pendingTarget}"]`
        )
        target?.scrollIntoView({ block: 'center' })
        target?.focus({ preventScroll: true })
        if (target) setHighlightedReply(pendingTarget)
        setPendingTarget(undefined)
      })
    })
    return () => {
      canceled = true
      cancelAnimationFrame(frame)
    }
  }, [pendingTarget, byId, loadingTarget])

  useLayoutEffect(() => {
    const root = container.current
    if (!root || style !== 'd') return
    let frame = 0
    const measure = () => {
      root.querySelectorAll<HTMLElement>('[data-thread-reply]').forEach(cell => {
        const branch = cell.parentElement
        const avatar =
          showAvatar &&
          cell.querySelector<HTMLElement>('.reply-layout .v2ex-avatar, .reply-meta img')
        const anchor =
          avatar ||
          cell.querySelector<HTMLElement>(
            '.reply-meta .user, .reply-meta strong, .reply-meta > a'
          ) ||
          cell.querySelector<HTMLElement>('.reply-meta > :first-child')
        if (!branch || !anchor || !anchor.getClientRects().length) return
        const rect = getReplyVerticalGeometry(anchor, branch)
        if (!rect.height) return
        const top = rect.top
        // 用户字体、徽章和换行会改变标题位置，按真实头像或用户名中心定位，而不是猜测行高
        const values = {
          '--tree-junction-y': top + rect.height / 2 + 0.5,
          '--tree-line-top': top + rect.height + 3
        }
        for (const [name, value] of Object.entries(values)) {
          const pixels = `${value}px`
          if (branch.style.getPropertyValue(name) !== pixels) branch.style.setProperty(name, pixels)
        }
      })
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(root)
    root
      .querySelectorAll('[data-thread-reply], .reply-meta')
      .forEach(element => observer.observe(element))
    measure()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [replies, style, showAvatar])

  useLayoutEffect(() => {
    const root = container.current
    if (!root || style !== 'f') return
    let frame = 0
    const measure = () => {
      const next = replies.map(reply => {
        const cell = root.querySelector<HTMLElement>(`[data-thread-reply="${reply.replyId}"]`)
        const head =
          (showAvatar && cell?.querySelector('.reply-layout .v2ex-avatar, .reply-meta img')) ||
          cell?.querySelector('.reply-meta') ||
          cell
        const box = head ? getReplyVerticalGeometry(head as HTMLElement, root) : undefined
        return {
          y: box ? box.top + box.height / 2 : 0
        }
      })
      setPoints(previous => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(root)
    root.querySelectorAll('[data-thread-reply]').forEach(cell => observer.observe(cell))
    root.addEventListener('load', schedule, true)
    measure()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      root.removeEventListener('load', schedule, true)
    }
  }, [replies, style, showAvatar])

  function reference(reply: TopicReply): TopicReplyReference {
    return {
      replyId: reply.replyId,
      userName: reply.userName,
      floor: reply.floor,
      url: `#r_${reply.replyId}`,
      content: reply.content,
      time: reply.time
    }
  }

  async function navigate(target: TopicReplyReference) {
    const request = ++navigationRequest.current
    setHighlightedReply(undefined)
    if (byId.has(target.replyId)) {
      setLoadingTarget(false)
      setPendingTarget(target.replyId)
      return
    }
    const destination = getTopicReplyTarget(target.url, topicId)
    if (onLoadPage && destination) {
      setLoadingTarget(true)
      setPendingTarget(target.replyId)
      try {
        await onLoadPage(destination.page)
      } catch (error) {
        if (request !== navigationRequest.current) return
        setPendingTarget(undefined)
        Toast.error((error as Error).message || '回复加载失败')
      } finally {
        if (request === navigationRequest.current) setLoadingTarget(false)
      }
    }
  }

  function targetLink(target: TopicReplyReference, children: ReactNode, className?: string) {
    return (
      <a
        className={className}
        href={resolveWebviewUrl(
          target.url.startsWith('#') ? `/t/${topicId}${target.url}` : target.url
        )}
        onClick={event => {
          if (!isStatic && (byId.has(target.replyId) || onLoadPage)) {
            event.preventDefault()
            event.stopPropagation()
            void navigate(target)
          }
        }}
      >
        {children}
      </a>
    )
  }

  function preview(target: TopicReplyReference) {
    return (
      <div className="thread-preview">
        <strong>
          {target.userName} #{target.floor}
        </strong>
        {target.time && <span className="thread-reference-time">{target.time}</span>}
        <EnhancedHtmlContent
          className="topic-content"
          html={transformHtml(target.content)}
          showImages={showImages}
          onTopicPreview={onTopicPreview}
        />
      </div>
    )
  }

  function chip(target: TopicReplyReference, key?: string) {
    const link = targetLink(target, `↩ #${target.floor} ${target.userName}`, 'thread-chip')
    return isStatic || !target.content ? (
      <span key={key}>{link}</span>
    ) : (
      <HoverCard key={key} content={preview(target)} className="thread-preview-popup">
        {link}
      </HoverCard>
    )
  }

  function strip(target: TopicReplyReference) {
    const text = new DOMParser().parseFromString(target.content, 'text/html').body.textContent || ''
    return targetLink(
      target,
      <>
        <strong>
          ↩ {target.userName} <span className="thread-strip-floor">#{target.floor}</span>
        </strong>
        <span>{text}</span>
      </>,
      'thread-strip'
    )
  }

  function quote(target: TopicReplyReference, seen = new Set<string>()): ReactNode {
    if (seen.has(target.replyId)) return null
    const visited = new Set(seen).add(target.replyId)
    const parent = byId.get(target.replyId)?.parent || target.parent
    return (
      <blockquote className={`thread-quote${seen.size >= 3 ? ' thread-quote--deep' : ''}`}>
        <div className="thread-quote-head">
          {targetLink(target, `${target.userName} #${target.floor}`)}
          <span>{target.time}</span>
        </div>
        {parent &&
          (isStatic ? (
            quote(parent, visited)
          ) : (
            <Collapsible>
              <CollapsibleTrigger className="thread-quote-toggle">
                ↑ 上文：{parent.userName} #{parent.floor}
              </CollapsibleTrigger>
              <CollapsibleContent>{quote(parent, visited)}</CollapsibleContent>
            </Collapsible>
          ))}
        <EnhancedHtmlContent
          className="topic-content"
          html={transformHtml(target.content)}
          showImages={showImages}
          onTopicPreview={onTopicPreview}
        />
      </blockquote>
    )
  }

  function decorations(reply: TopicReply): ReplyDecorations {
    const parent = reply.parent
    const external = parent && !byId.has(parent.replyId)
    const grandparent = parent && byId.get(parent.replyId)?.parent
    const answeredBy = answeredReferences.get(reply.replyId) || []
    let meta: ReactNode
    if (style === 'b' && parent) meta = chip(parent)
    if (style === 'f' && parent) {
      const station = layout.stations.find(item => replies[item.row].replyId === reply.replyId)
      if (
        station &&
        layout.parents[station.row] >= 0 &&
        station.previous !== layout.parents[station.row]
      )
        meta = targetLink(parent, `↩ #${parent.floor}`, 'thread-line-jump')
    }
    return {
      content: getReplyDisplayContent(
        reply.content,
        (style === 'c' || style === 'd') && parent && byId.has(parent.replyId) ? parent : undefined
      ),
      beforeTime:
        style === 'c' && parent && grandparent && byId.has(grandparent.replyId)
          ? targetLink(parent, `回复 ${parent.userName}`, 'thread-reply-to')
          : undefined,
      before:
        parent &&
        (style === 'a' ||
          ((style === 'c' || style === 'd') && external) ||
          (style === 'f' &&
            layout.parents[replies.findIndex(item => item.replyId === reply.replyId)] < 0))
          ? strip(parent)
          : style === 'h' && parent
            ? quote(parent)
            : undefined,
      meta,
      after:
        answeredBy.length > 0 ? (
          <div className="thread-answered">
            被回复 {answeredBy.map(target => chip(target, target.replyId))}
          </div>
        ) : undefined
    }
  }

  function cell(reply: TopicReply, treeToggle?: ReactNode) {
    const related = decorations(reply)
    if (treeToggle)
      related.after = (
        <>
          {related.after}
          {treeToggle}
        </>
      )
    return (
      <div
        className={`reply-item${!isStatic && highlightedReply === reply.replyId ? ' reply-item--located' : ''}`}
        data-thread-reply={reply.replyId}
        tabIndex={-1}
        key={reply.replyId}
      >
        {style === 'f' && !isStatic && lined.has(reply.replyId) && (
          <button
            type="button"
            className="thread-line-pin"
            aria-label={`固定或取消 #${reply.floor} 的对话连线高亮`}
            aria-pressed={pinnedReply === reply.replyId}
            onClick={() => toggleLinePin(reply.replyId)}
          />
        )}
        {renderReply(reply, related)}
      </div>
    )
  }

  function branch(node: TopicReplyNode, depth = 0): ReactNode {
    if (style === 'c') {
      const descendants = flattenReplyGroup(node.children)
      return (
        <div className="thread-group-root" key={node.replyId}>
          {cell(node)}
          {descendants.length > 0 && (
            <div className="thread-group">{descendants.map(reply => cell(reply))}</div>
          )}
        </div>
      )
    }
    const descendants = flattenReplyTree(node.children)
    const open = isStatic || !folded.has(node.replyId)
    return (
      <Collapsible
        key={node.replyId}
        className={`thread-branch${depth > 0 ? ' thread-branch--joined' : ''}${node.children.length ? ' thread-branch--expandable' : ''}`}
        open={open}
        onOpenChange={next => {
          if (!next) {
            const cell = container.current?.querySelector<HTMLElement>(
              `[data-thread-reply="${node.replyId}"]`
            )
            const viewport = container.current?.closest('.v2ex-scroll-area__viewport')
            const top = viewport?.getBoundingClientRect().top || 0
            if (cell && cell.getBoundingClientRect().top < top)
              cell.scrollIntoView({ block: 'start' })
          }
          setFolded(current => {
            const result = new Set(current)
            if (next) result.delete(node.replyId)
            else result.add(node.replyId)
            return result
          })
        }}
        style={
          {
            '--thread-depth': depth,
            '--thread-parent-depth': Math.max(depth - 1, 0)
          } as CSSProperties
        }
      >
        {cell(
          node,
          !isStatic && !open && node.children.length > 0 && (
            <CollapsibleTrigger
              className="thread-fold"
              aria-label={`${open ? '收起' : '展开'} #${node.floor} 的 ${descendants.length} 条回复`}
            >
              <ChevronRight aria-hidden="true" />
              <span>{descendants.length} 条回复</span>
            </CollapsibleTrigger>
          )
        )}
        {node.children.length > 0 && (
          <>
            {isStatic ? (
              <span className="thread-tree-line" aria-hidden="true" />
            ) : (
              <CollapsibleTrigger
                className="thread-tree-line"
                aria-label={`${open ? '收起' : '展开'} #${node.floor} 的回复线`}
              >
                {open ? (
                  <Minus className="thread-tree-collapse-icon" aria-hidden="true" />
                ) : (
                  <Plus className="thread-tree-collapse-icon" aria-hidden="true" />
                )}
              </CollapsibleTrigger>
            )}
            <CollapsibleContent className="thread-children" keepMounted={isStatic}>
              {node.children.map(child => branch(child, depth + 1))}
            </CollapsibleContent>
          </>
        )}
      </Collapsible>
    )
  }

  const lanes = Math.max(0, ...layout.segments.map(segment => segment.lane + 1))
  const gutter = lanes ? 7 + 12 + (lanes - 1) * 9 : 0
  const laneX = (lane: number) => gutter - 12 - lane * 9
  const spans = layout.segments.map(segment => ({
    lane: segment.lane,
    top: (points[segment.rows[0]]?.y || 0) - (segment.cutAbove ? 20 : 0),
    bottom: (points[segment.rows.at(-1)!]?.y || 0) + (segment.cutBelow ? 20 : 0)
  }))
  const gaps = layout.stations.filter(station =>
    spans.some(
      span =>
        span.lane < station.lane &&
        span.top <= (points[station.row]?.y || 0) &&
        span.bottom >= (points[station.row]?.y || 0)
    )
  )
  return (
    <div
      ref={container}
      aria-busy={loadingTarget}
      onPointerOver={event => {
        if (style !== 'f' || isStatic || pinnedReply || event.pointerType !== 'mouse') return
        setHoveredReply(
          (event.target as Element).closest<HTMLElement>('[data-thread-reply]')?.dataset.threadReply
        )
      }}
      onPointerLeave={() => {
        if (!pinnedReply) setHoveredReply(undefined)
      }}
      onFocusCapture={event => {
        if (style === 'f' && !isStatic && !pinnedReply)
          setHoveredReply(
            (event.target as Element).closest<HTMLElement>('[data-thread-reply]')?.dataset
              .threadReply
          )
      }}
      onBlurCapture={event => {
        if (!pinnedReply && !event.currentTarget.contains(event.relatedTarget as Node | null))
          setHoveredReply(undefined)
      }}
      onClickCapture={event => {
        if (isStatic || event.defaultPrevented) return
        const avatar = (event.target as Element).closest('.member-avatar-button')
        const owner = avatar?.closest<HTMLElement>('[data-thread-reply]')?.dataset.threadReply
        if (style === 'f' && owner && lined.has(owner)) {
          event.preventDefault()
          event.stopPropagation()
          toggleLinePin(owner)
          return
        }
        const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
        const href = anchor?.getAttribute('href')
        const target = href && getTopicReplyTarget(href, topicId)
        if (!target || (!byId.has(target.replyId) && !onLoadPage)) return
        event.preventDefault()
        event.stopPropagation()
        void navigate({ replyId: target.replyId, url: href!, floor: '', userName: '', content: '' })
      }}
      className={`reply-thread-list reply-thread-list--${style}${showAvatar ? '' : ' reply-thread-list--no-avatar'}${isStatic ? ' reply-thread-list--static' : ''}`}
      style={{ '--thread-gutter': `${gutter}px` } as CSSProperties}
    >
      {loadingTarget && (
        <div className="thread-loading">
          <Spinner aria-label="加载目标回复" /> 加载目标回复…
        </div>
      )}
      {style === 'f' && lanes > 0 && points.length === replies.length && (
        <svg
          className={`thread-lines${focusConversation !== undefined && !isStatic ? ' thread-lines--focused' : ''}`}
          aria-hidden="true"
          width={gutter}
          height="100%"
        >
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={gutter} height="100%">
              <rect width="100%" height="100%" fill="white" />
              {gaps.map(station => (
                <path
                  key={station.row}
                  d={`M${laneX(station.lane) + 5.5},${points[station.row].y}H${gutter - 2}`}
                  style={{ stroke: 'black', strokeWidth: 7 }}
                />
              ))}
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>
            {layout.segments.map((segment, index) => {
              const x = laneX(segment.lane),
                top = points[segment.rows[0]].y,
                bottom = points[segment.rows.at(-1)!].y
              return (
                <g
                  key={index}
                  className={`thread-line-${segment.color} thread-line-piece${segment.conversation === focusConversation ? ' is-lit' : ''}`}
                >
                  {bottom > top && <path d={`M${x},${top}V${bottom}`} />}
                  {segment.cutAbove && (
                    <path className="thread-line-cut" d={`M${x},${top - 20}V${top - 7}`} />
                  )}
                  {segment.cutBelow && (
                    <path className="thread-line-cut" d={`M${x},${bottom + 7}V${bottom + 20}`} />
                  )}
                </g>
              )
            })}
          </g>
          {layout.stations.map(station => {
            const x = laneX(station.lane),
              y = points[station.row].y
            return (
              <g
                key={station.row}
                data-line-row={station.row}
                className={`thread-line-${station.color} thread-line-piece thread-line-station${station.conversation === focusConversation ? ' is-lit' : ''}${station.row === focusRow ? ' is-here' : ''}${station.row === layout.parents[focusRow] ? ' is-parent' : ''}`}
              >
                <path d={`M${x},${y}H${gutter - 1}`} />
                <circle cx={x} cy={y} r="3.5" />
              </g>
            )
          })}
        </svg>
      )}
      {style === 'c' || style === 'd'
        ? tree.map(node => branch(node))
        : replies.map(reply => cell(reply))}
    </div>
  )
}
