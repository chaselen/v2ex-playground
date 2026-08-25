import type { CreateTopicInput, CreateTopicResult, Node, TopicSyntax } from '../v2ex/types'
export type { Node, TopicSyntax } from '../v2ex/types'
export {
  DEFAULT_TOPIC_SYNTAX,
  TOPIC_CONTENT_MAX_LENGTH,
  TOPIC_TITLE_MAX_LENGTH
} from '../v2ex/types'
import type { WebviewCommonRpcCommands, WebviewStateRpcCommands } from './commonView'

/** 创作新主题草稿 */
export interface CreateTopicDraft {
  /** 主题标题 */
  title: string
  /** 主题正文 */
  content: string
  /** 正文语法 */
  syntax: TopicSyntax
  /** 已选节点 */
  node?: Node
}

/** 创作新主题表单状态 */
export interface CreateTopicFormState {
  /** 当前登录用户名，用于识别账号切换 */
  username: string
  /** 标题字符上限 */
  titleMaxLength: number
  /** 正文字符上限 */
  contentMaxLength: number
  /** 当前草稿 */
  draft: CreateTopicDraft
}

/** 创作新主题面板状态 */
export type CreateTopicPanelViewState =
  | { status: 'loading' }
  | { status: 'form'; form: CreateTopicFormState }
  | { status: 'error'; message: string; showLogin?: boolean }

/** 创作新主题面板 RPC 命令 */
export interface CreateTopicPanelRpcCommands
  extends WebviewCommonRpcCommands, WebviewStateRpcCommands<CreateTopicPanelViewState> {
  /** 重新加载创作表单 */
  reload(): void
  /** 执行登录并重新加载表单 */
  login(): void
  /** 打开节点选择器 */
  selectNode(currentNodeName?: string): Node | undefined
  /** 保存当前草稿 */
  saveDraft(draft: CreateTopicDraft): void
  /** 发布新主题 */
  createTopic(input: CreateTopicInput): CreateTopicResult
  /** 预览新主题正文 */
  previewTopic(payload: { content: string; syntax: TopicSyntax }): string
  /** 上传正文图片 */
  uploadImage(payload: { filename: string; mimeType: string; base64: string }): string
  /** 检测 Imgur 连通性 */
  checkImgurConnectivity(payload: { target: 'upload'; refresh?: boolean }): boolean
}

/** 创作新主题面板事件 */
export interface CreateTopicPanelWebviewEvents {
  createTopicStateChanged: {
    /** 最新面板状态 */
    state: CreateTopicPanelViewState
  }
  createTopicNodeSelected: {
    /** 从其他页面预选的节点 */
    node: Node
  }
}
