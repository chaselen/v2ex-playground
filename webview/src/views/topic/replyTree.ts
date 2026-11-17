import type { TopicReply, ReplyThreadStyle } from '@extension/v2ex/types'

/** 带有官方子回复的节点，不从正文 @ 或楼层号推断关系 */
export interface TopicReplyNode extends TopicReply {
  children: TopicReplyNode[]
}

/** 根据明确父回复编号构树；跨页目标、未来楼层和异常自引用保持顶层 */
export function buildReplyTree(replies: TopicReply[]): TopicReplyNode[] {
  const nodes = [...replies]
    .sort((a, b) => Number(a.floor) - Number(b.floor))
    .map<TopicReplyNode>(reply => ({ ...reply, children: [] }))
  const byId = new Map(nodes.map(node => [node.replyId, node]))
  const roots: TopicReplyNode[] = []
  for (const node of nodes) {
    const parent = byId.get(node.parent?.replyId || '')
    if (parent && Number(parent.floor) < Number(node.floor)) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** 官网设置的中文名称 */
export const replyThreadStyleLabels: Record<ReplyThreadStyle, string> = {
  off: '经典平铺',
  a: '引用条',
  b: '角标 + 悬浮预览',
  c: '楼中楼',
  d: '树形缩进',
  f: '对话连线',
  h: '引用楼层'
}

/** 将树展开，保留官方讨论顺序 */
export function flattenReplyTree(nodes: TopicReplyNode[]): TopicReplyNode[] {
  return nodes.flatMap(node => [node, ...flattenReplyTree(node.children)])
}

/** 楼中楼组内按楼层排序；树形模式仍按父子关系展开 */
export function flattenReplyGroup(nodes: TopicReplyNode[]): TopicReplyNode[] {
  return flattenReplyTree(nodes).sort((a, b) => Number(a.floor) - Number(b.floor))
}

/** 官网对话连线中的连续轨道片段，轨道被占用时以虚线暂停和续接 */
export interface ReplyLineSegment {
  conversation: number
  color: number
  lane: number
  rows: number[]
  cutAbove: boolean
  cutBelow: boolean
}

/**
 * 按完整讨论分配轨道；拥挤时暂停下次出现最晚的讨论，而不是丢弃关联
 * @param maxLanes 内部调用传入正整数；官网默认五条轨道
 */
export function getReplyLineLayout(replies: TopicReply[], maxLanes = 5) {
  const index = new Map(replies.map((reply, i) => [reply.replyId, i]))
  const parents = replies.map((reply, i) => {
    const parent = index.get(reply.parent?.replyId || '')
    return parent !== undefined && parent < i ? parent : -1
  })
  const roots: number[] = []
  const rowsOf = new Map<number, number[]>()
  parents.forEach((parent, i) => {
    roots[i] = parent < 0 ? i : roots[parent]
    const rows = rowsOf.get(roots[i]) || []
    rows.push(i)
    rowsOf.set(roots[i], rows)
  })
  interface Conversation {
    id: number
    rows: number[]
    next: number
    color?: number
    segment?: ReplyLineSegment
  }
  const conversations: Conversation[] = [...rowsOf.values()]
    .filter(rows => rows.length > 1)
    .map((rows, id) => ({ id, rows, next: 0 }))
  const conversationOf = new Map<number, Conversation>()
  conversations.forEach(conversation =>
    conversation.rows.forEach(row => conversationOf.set(row, conversation))
  )
  const holder: (Conversation | undefined)[] = []
  const live = new Set<Conversation>()
  const lastUsed = [0, 0, 0, 0, 0, 0]
  let clock = 0
  const segments: ReplyLineSegment[] = []
  for (let row = 0; row < replies.length; row++) {
    const conversation = conversationOf.get(row)
    if (!conversation) continue
    if (conversation.color === undefined) {
      const drawn = new Set(holder.filter(Boolean).map(value => value!.color))
      const taken = new Set([...live].map(value => value.color))
      conversation.color = [0, 1, 2, 3, 4, 5].sort(
        (a, b) =>
          Number(drawn.has(a)) - Number(drawn.has(b)) ||
          Number(taken.has(a)) - Number(taken.has(b)) ||
          lastUsed[a] - lastUsed[b]
      )[0]
      lastUsed[conversation.color] = ++clock
      live.add(conversation)
    }
    if (!conversation.segment) {
      let lane = 0
      while (lane < maxLanes && holder[lane]) lane++
      if (lane === maxLanes) {
        lane = 0
        for (let candidate = 1; candidate < maxLanes; candidate++) {
          if (
            holder[candidate]!.rows[holder[candidate]!.next] >
            holder[lane]!.rows[holder[lane]!.next]
          )
            lane = candidate
        }
        holder[lane]!.segment!.cutBelow = true
        holder[lane]!.segment = undefined
      }
      holder[lane] = conversation
      conversation.segment = {
        conversation: conversation.id,
        lane,
        color: conversation.color,
        rows: [],
        cutAbove: conversation.next > 0,
        cutBelow: false
      }
      segments.push(conversation.segment)
    }
    conversation.segment.rows.push(row)
    conversation.next++
    if (conversation.next === conversation.rows.length) {
      holder[conversation.segment.lane] = undefined
      conversation.segment = undefined
      live.delete(conversation)
    }
  }
  const stations = segments.flatMap(segment =>
    segment.rows.map((row, i) => ({
      row,
      lane: segment.lane,
      color: segment.color,
      conversation: segment.conversation,
      previous: i > 0 ? segment.rows[i - 1] : -1
    }))
  )
  return { segments, stations, parents }
}
