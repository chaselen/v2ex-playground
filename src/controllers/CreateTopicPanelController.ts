import vscode from 'vscode'
import G from '@/global'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { uploadImage } from '@/core/imageUpload'
import { checkImgurConnectivity } from '@/features/connectivityCheck'
import {
  clearCreateTopicDraft,
  getCreateTopicDraft,
  saveCreateTopicDraft
} from '@/features/createTopicDraft'
import { logger } from '@/core/logger'
import { showNodeQuickPick } from '@/features/nodeQuickPick'
import { getV2exNodeAvatarUrl } from '@/features/nodeAvatars'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import {
  WebviewCommonController,
  type WebviewNavigationDeps
} from '@/controllers/WebviewCommonController'
import type {
  CreateTopicDraft,
  CreateTopicPanelRpcCommands,
  CreateTopicPanelViewState,
  CreateTopicPanelWebviewEvents,
  WebviewRpcController
} from '@/shared/webview'
import type { CreateTopicInput, Node } from '@/v2ex'
import {
  DEFAULT_TOPIC_SYNTAX,
  LoginRequiredError,
  TOPIC_CONTENT_MAX_LENGTH,
  TOPIC_TITLE_MAX_LENGTH
} from '@/v2ex'

/** 创作新主题面板控制器 */
export class CreateTopicPanelController
  extends WebviewCommonController
  implements WebviewRpcController<CreateTopicPanelRpcCommands>
{
  /** 创作面板 */
  private readonly panel: vscode.WebviewPanel
  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<CreateTopicPanelRpcCommands, CreateTopicPanelWebviewEvents>
  /** 当前视图状态 */
  private viewState: CreateTopicPanelViewState = { status: 'loading' }
  /** 当前节点列表 */
  private nodes: Node[] = []
  /** 当前草稿所属用户名 */
  private username = ''
  /** 等待表单加载后应用的预选节点 name */
  private pendingNodeName = ''

  /**
   * @param deps 外部面板导航依赖
   * @param initialNodeName 初次打开时需要预选的节点 name
   */
  constructor(deps: WebviewNavigationDeps, initialNodeName?: string) {
    super(deps)
    this.pendingNodeName = initialNodeName?.trim() || ''
    this.panel = createV2exWebviewPanel({
      viewType: 'v2ex.createTopic',
      title: '创作新主题',
      htmlEntry: 'create-topic.html',
      useDefaultIcon: true
    })
    this.rpc = new WebviewRpcBridge<CreateTopicPanelRpcCommands, CreateTopicPanelWebviewEvents>(
      this.panel.webview,
      this
    )
    this.panel.onDidDispose(() => this.rpc.dispose())
  }

  /** 激活当前面板 */
  reveal() {
    this.panel.reveal()
  }

  /**
   * 预选主题节点并保留当前草稿的其他字段
   * @param nodeName 需要预选的节点 name
   */
  selectNode(nodeName: string) {
    const normalizedNodeName = nodeName.trim()
    if (!normalizedNodeName) return
    if (this.viewState.status !== 'form') {
      this.pendingNodeName = normalizedNodeName
      return
    }

    const selectedNode = this.toSelectedNode(normalizedNodeName)
    if (!selectedNode) return
    const draft = normalizeDraft({ ...this.viewState.form.draft, node: selectedNode })
    this.viewState = {
      status: 'form',
      form: { ...this.viewState.form, draft }
    }
    this.rpc.post('createTopicNodeSelected', { node: selectedNode })
  }

  /**
   * 从全量节点列表生成表单节点
   * @param nodeName 节点 name
   */
  private toSelectedNode(nodeName: string): Node | undefined {
    const node = this.nodes.find(item => item.name === nodeName)
    if (!node) return undefined
    return {
      name: node.name,
      title: node.title,
      avatar: getV2exNodeAvatarUrl(node.name, 'normal')
    }
  }

  /** 监听面板销毁 */
  onDidDispose(listener: () => void) {
    this.panel.onDidDispose(listener)
  }

  /** 加载创作表单 */
  load() {
    return this.reload(true)
  }

  /** 登录态变化后刷新创作表单 */
  refreshForAuthChange() {
    return this.reload(true)
  }

  /** 获取当前视图状态 */
  rpc_ready() {
    return this.viewState
  }

  /** 重新加载创作表单 */
  rpc_reload() {
    return this.reload(true)
  }

  /** 执行登录并重新加载表单 */
  async rpc_login() {
    await vscode.commands.executeCommand('v2ex.login')
    await this.reload(true)
  }

  /** 打开节点选择器 */
  async rpc_selectNode(currentNodeName?: string) {
    const selected = await showNodeQuickPick(this.nodes, {
      title: '选择主题节点',
      placeHolder: '输入节点标题或 name 搜索',
      currentNodeName,
      countField: 'topicCount',
      sortByCountDescending: true
    })
    if (!selected) return undefined
    return {
      name: selected.name,
      title: selected.title,
      avatar: getV2exNodeAvatarUrl(selected.name, 'normal')
    }
  }

  /** 保存当前草稿 */
  async rpc_saveDraft(draft: CreateTopicDraft) {
    if (!this.username) return
    const normalizedDraft = normalizeDraft(draft)
    if (this.viewState.status === 'form') {
      this.viewState = {
        status: 'form',
        form: { ...this.viewState.form, draft: normalizedDraft }
      }
    }
    await saveCreateTopicDraft(this.username, normalizedDraft)
  }

  /** 发布新主题 */
  async rpc_createTopic(input: CreateTopicInput) {
    if (!this.nodes.some(node => node.name === input.nodeName)) {
      throw new Error('所选节点不在最新节点列表中，请重新选择')
    }
    const result = await G.V2ex.createTopic(input)
    if (this.username) {
      await clearCreateTopicDraft(this.username)
    }
    return result
  }

  /** 预览新主题正文 */
  rpc_previewTopic(payload: { content: string; syntax: CreateTopicInput['syntax'] }) {
    return G.V2ex.previewTopic(payload.content, payload.syntax)
  }

  /** 上传正文图片 */
  rpc_uploadImage(message: { filename: string; mimeType: string; base64: string }) {
    return uploadImage(message)
  }

  /** 检测 Imgur 连通性 */
  rpc_checkImgurConnectivity(message: { target: 'upload'; refresh?: boolean }) {
    return checkImgurConnectivity(message.target, message.refresh)
  }

  /** 加载或重新加载创作表单 */
  private async reload(showLoading: boolean) {
    if (showLoading) {
      this.postViewState({ status: 'loading' })
    }

    try {
      if (!(await G.V2ex.ensureAuthenticated())) {
        throw new LoginRequiredError('创作新主题需要先登录')
      }
      this.username = G.V2ex.getAuthenticatedUsername() || ''
      this.nodes = await G.V2ex.getAllNodes()
      const savedDraft = this.username ? getCreateTopicDraft(this.username) : undefined
      const draft = normalizeDraft(
        savedDraft || {
          title: '',
          content: '',
          syntax: DEFAULT_TOPIC_SYNTAX
        }
      )
      if (draft.node && !this.nodes.some(node => node.name === draft.node?.name)) {
        draft.node = undefined
      }
      if (this.pendingNodeName) {
        draft.node = this.toSelectedNode(this.pendingNodeName)
        this.pendingNodeName = ''
      }
      this.postViewState({
        status: 'form',
        form: {
          username: this.username,
          titleMaxLength: TOPIC_TITLE_MAX_LENGTH,
          contentMaxLength: TOPIC_CONTENT_MAX_LENGTH,
          draft
        }
      })
    } catch (err) {
      logger.error('创作新主题表单加载失败', err)
      this.nodes = []
      this.postViewState({
        status: 'error',
        message: (err as Error).message || '创作新主题表单加载失败',
        showLogin: err instanceof LoginRequiredError
      })
    }
  }

  /** 同步最新视图状态 */
  private postViewState(state: CreateTopicPanelViewState) {
    this.viewState = state
    this.rpc.post('createTopicStateChanged', { state })
  }
}

/** 规范化可持久化草稿 */
function normalizeDraft(draft: CreateTopicDraft): CreateTopicDraft {
  return {
    title: draft.title || '',
    content: draft.content || '',
    syntax: draft.syntax === 'default' ? 'default' : 'markdown',
    node: draft.node?.name
      ? {
          name: draft.node.name.trim(),
          title: draft.node.title.trim() || draft.node.name.trim(),
          avatar: getV2exNodeAvatarUrl(draft.node.name.trim(), 'normal')
        }
      : undefined
  }
}
