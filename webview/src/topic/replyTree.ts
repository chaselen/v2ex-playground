import type { TopicReply } from '../../../src/v2ex/types'

/** 带子回复的帖子回复节点 */
export interface TopicReplyNode extends TopicReply {
  // TODO: 为父子关系增加置信度与匹配来源，路线参见 docs/nested-replies.md
  children: TopicReplyNode[]
}

interface ReplyReference {
  userName: string
  floor?: string
}

/**
 * 将回复 HTML 转换为用于识别引用的纯文本
 * @param content 回复 HTML
 */
function getReplyText(content: string): string {
  const template = document.createElement('template')
  template.innerHTML = content
  return template.content.textContent || ''
}

/**
 * 按书写顺序提取回复中的用户与紧随其后的楼层引用
 * @param content 回复 HTML
 */
function getReplyReferences(
  content: string,
  extractText: (content: string) => string
): ReplyReference[] {
  const text = extractText(content)
  const references = Array.from(
    text.matchAll(/@([a-zA-Z0-9_-]+)(?:\s*#(\d+))?/g),
    ([, userName, floor]) => ({ userName, floor })
  )
  const referencedFloors = [...text.matchAll(/#(\d+)/g)].map(([, floor]) => floor)
  const uniqueFloors = [...new Set(referencedFloors)]

  // 只有一个楼层号时，允许它与任一被提及用户进行精确作者匹配
  const sharedFloor = uniqueFloors.length === 1 ? uniqueFloors[0] : undefined
  if (sharedFloor) {
    for (const reference of references) {
      if (!reference.floor) {
        reference.floor = sharedFloor
      }
    }
  }

  return references
}

/**
 * 将当前页回复构建为楼中楼树
 *
 * 优先使用“用户名 + 楼层”精确定位；单用户引用无法精确定位时，再回退到该用户
 * 在当前页最近的一条历史回复。多人引用没有精确关系时保持顶层，避免猜测父节点。
 * 只允许关联当前位置之前的回复，避免循环和跨页误挂载。
 *
 * 规则说明参见 docs/nested-replies.md
 *
 * @param replies 当前回复页的平铺回复
 * @param extractText 回复 HTML 纯文本提取器
 */
export function buildReplyTree(
  replies: TopicReply[],
  extractText: (content: string) => string = getReplyText
): TopicReplyNode[] {
  const nodes = replies.map<TopicReplyNode>(reply => ({ ...reply, children: [] }))
  const roots: TopicReplyNode[] = []
  const indexByUserAndFloor = new Map<string, number>()
  const lastIndexByUser = new Map<string, number>()

  nodes.forEach((node, index) => {
    indexByUserAndFloor.set(`${node.userName}:${node.floor}`, index)
  })

  nodes.forEach((node, index) => {
    const references = getReplyReferences(node.content, extractText)
    let parentIndex: number | undefined

    // 第一轮检查所有精确引用，避免较晚出现的模糊引用抢先命中
    for (const reference of [...references].reverse()) {
      if (!reference.floor) {
        continue
      }

      const exactIndex = indexByUserAndFloor.get(`${reference.userName}:${reference.floor}`)
      if (exactIndex !== undefined && exactIndex < index) {
        parentIndex = exactIndex
        break
      }
    }

    // 只有单用户引用允许模糊匹配，多人引用没有精确关系时保持顶层
    if (parentIndex === undefined && references.length === 1) {
      parentIndex = lastIndexByUser.get(references[0].userName)
    }

    if (parentIndex === undefined) {
      roots.push(node)
    } else {
      nodes[parentIndex].children.push(node)
    }

    lastIndexByUser.set(node.userName, index)
  })

  return roots
}
