import type { Node } from '../v2ex/types'

/** 创作新主题草稿 */
export interface CreateTopicDraft {
  /** 主题标题 */
  title: string
  /** 主题正文 */
  content: string
  /** 已选节点 */
  node?: Node
}
