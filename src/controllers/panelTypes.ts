/**
 * 打开用户面板所需的最小参数
 */
export interface MemberPanelInput {
  /** 面板标题 */
  label?: string
  /** 用户名 */
  username: string
}

/**
 * 打开话题面板所需的最小参数
 */
export interface TopicPanelInput {
  /** 话题标题 */
  label: string
  /** 话题 id */
  topicId: number | string
}

/**
 * 打开节点主题标签所需的最小参数
 */
export interface NodeTabInput {
  /** 节点 name */
  name: string
  /** 节点展示标题 */
  title?: string
}
