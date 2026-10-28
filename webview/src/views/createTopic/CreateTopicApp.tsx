import NodeSelectButton from '@/components/NodeSelectButton'
import { useEffect, useRef, useState } from 'react'
import { Info, Send, SquarePen } from 'lucide-react'
import {
  ScrollArea,
  Alert,
  Button,
  ConfirmPopover,
  Input,
  RadioGroup,
  RadioGroupItem,
  Toast,
  Tooltip
} from '@/components/ui'
import { handleWebviewLinkClick } from '@/core/linkNavigation'
import { createVsCodeClient, subscribeWebviewState } from '@/core/vscode'
import ReplyComposer from '@/views/topic/ReplyComposer'
import {
  DEFAULT_TOPIC_SYNTAX,
  TOPIC_CONTENT_MAX_LENGTH,
  TOPIC_TITLE_MAX_LENGTH
} from '@extension/shared/webview'
import type {
  CreateTopicDraft,
  CreateTopicPanelRpcCommands,
  CreateTopicPanelViewState,
  CreateTopicPanelWebviewEvents,
  TopicSyntax
} from '@extension/shared/webview'

/** 创作新主题 VS Code 通信客户端 */
const vscode = createVsCodeClient<CreateTopicPanelRpcCommands, CreateTopicPanelWebviewEvents>()

/** 空白草稿 */
const emptyDraft: CreateTopicDraft = {
  title: '',
  content: '',
  syntax: DEFAULT_TOPIC_SYNTAX
}

/** 创作新主题页面 */
export default function CreateTopicApp() {
  const [state, setState] = useState<CreateTopicPanelViewState>({ status: 'loading' })
  const [draft, setDraft] = useState<CreateTopicDraft>(emptyDraft)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [composerResetKey, setComposerResetKey] = useState(0)
  const [draftSaved, setDraftSaved] = useState(true)
  const titleRef = useRef<HTMLInputElement>(null)
  const nodeSelectRef = useRef<HTMLButtonElement>(null)
  const draftUsernameRef = useRef('')

  useEffect(
    () =>
      subscribeWebviewState(
        handler => {
          const disposeState = vscode.on('createTopicStateChanged', data => handler(data.state))
          const disposeNode = vscode.on('createTopicNodeSelected', data =>
            setDraft(current => ({ ...current, node: data.node }))
          )
          return () => {
            disposeState()
            disposeNode()
          }
        },
        () => vscode.ready(),
        nextState => {
          setState(nextState)
          if (nextState.status === 'form' && draftUsernameRef.current !== nextState.form.username) {
            draftUsernameRef.current = nextState.form.username
            setDraft(nextState.form.draft)
            requestAnimationFrame(() => titleRef.current?.focus())
          }
        },
        error => setState({ status: 'error', message: (error as Error).message })
      ),
    []
  )

  useEffect(() => {
    if (!draftUsernameRef.current || state.status !== 'form') return
    setDraftSaved(false)
    const timer = window.setTimeout(() => {
      vscode
        .saveDraft(draft)
        .then(() => setDraftSaved(true))
        .catch(error => console.error(error))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft, state.status])

  /** 更新草稿字段 */
  function updateDraft<Key extends keyof CreateTopicDraft>(key: Key, value: CreateTopicDraft[Key]) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  /** 发布主题 */
  async function publishTopic() {
    if (state.status !== 'form' || publishing) return
    const title = draft.title.trim()
    if (!title) {
      Toast.warning('主题标题不能为空')
      requestAnimationFrame(() => titleRef.current?.focus())
      return
    }
    if (!draft.node) {
      Toast.warning('请选择主题节点')
      nodeSelectRef.current?.click()
      return
    }

    setPublishing(true)
    try {
      const result = await vscode.createTopic({
        title,
        content: draft.content,
        syntax: draft.syntax,
        nodeName: draft.node.name
      })
      Toast.success('主题发布成功')
      setDraft({ ...emptyDraft })
      setComposerResetKey(current => current + 1)
      void vscode.openTopic(result.topicId, result.title)
    } catch (err) {
      Toast.error((err as Error).message || '发布主题失败')
    } finally {
      setPublishing(false)
    }
  }

  /**
   * 上传单张主题正文图片
   * @param file 图片文件
   */
  async function uploadTopicImage(file: File): Promise<string> {
    return vscode.uploadImage({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64: await readFileAsBase64(file)
    })
  }

  /**
   * 检测主题正文图片服务连通性
   * @param target 连通性检测目标
   * @param refresh 是否强制刷新检测结果
   */
  function checkTopicImageConnectivity(target: 'upload', refresh: boolean) {
    return vscode.checkImgurConnectivity(target, refresh)
  }

  if (state.status === 'error') {
    return (
      <main className="create-topic-state">
        <Alert variant="danger" title="无法创作新主题" description={state.message} />
        <div className="create-topic-state-actions">
          {state.showLogin && (
            <Button variant="primary" onClick={() => void vscode.login()}>
              登录
            </Button>
          )}
          <Button onClick={() => void vscode.reload()}>重试</Button>
        </div>
      </main>
    )
  }

  /** 表单初始化期间使用静态网页版约束直接渲染 */
  const initializing = state.status === 'loading'
  const titleMaxLength =
    state.status === 'form' ? state.form.titleMaxLength : TOPIC_TITLE_MAX_LENGTH
  const contentMaxLength =
    state.status === 'form' ? state.form.contentMaxLength : TOPIC_CONTENT_MAX_LENGTH
  const formDisabled = initializing || publishing
  const canPublish =
    !initializing && Boolean(draft.title.trim() && draft.node) && !publishing && !uploading

  return (
    <ScrollArea fillViewport className="create-topic-scroll" role="main">
      <main className="create-topic-container">
        <header className="create-topic-header">
          <div className="create-topic-heading">
            <span className="create-topic-heading-icon">
              <SquarePen aria-hidden="true" />
            </span>
            <div>
              <h1>创作新主题</h1>
              <p>整理好你的想法，选择合适的节点与大家分享</p>
            </div>
          </div>
          <span className="create-topic-draft-state" role="status" aria-live="polite">
            {initializing ? '正在恢复草稿…' : draftSaved ? '草稿已保存' : '正在保存草稿…'}
          </span>
        </header>

        <div
          className="create-topic-form"
          aria-busy={publishing}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canPublish) {
              event.preventDefault()
              void publishTopic()
            }
          }}
        >
          <section className="create-topic-card">
            <div className="create-topic-field">
              <div className="create-topic-field-heading">
                <label htmlFor="create-topic-title">
                  <span className="create-topic-required" aria-hidden="true">
                    *
                  </span>
                  主题标题
                </label>
                <span className="create-topic-count">
                  {draft.title.length} / {titleMaxLength}
                </span>
              </div>
              <Input
                ref={titleRef}
                id="create-topic-title"
                size="large"
                value={draft.title}
                maxLength={titleMaxLength}
                placeholder="用一句清晰的话概括主题"
                disabled={formDisabled}
                aria-required="true"
                onValueChange={value => updateDraft('title', value)}
              />
            </div>

            <ReplyComposer
              className="create-topic-composer"
              showImages
              showEmoticons={false}
              resetKey={`${draft.syntax}:${composerResetKey}`}
              value={draft.content}
              maxLength={contentMaxLength}
              rows={11}
              placeholder="可以在正文中补充更多细节；标题已经能够表达完整内容时，正文可以留空"
              previewEmptyText="目前还没有输入任何可以被预览的内容"
              previewAriaLabel="生成主题预览"
              previewRequiresContent={false}
              transformContent={preserveContent}
              disabled={formDisabled}
              toolbarClassName="create-topic-editor-toolbar"
              toolbarEnd={
                <div className="create-topic-syntax-tools">
                  <RadioGroup
                    className="create-topic-syntax"
                    size="small"
                    variant="segmented"
                    value={draft.syntax}
                    disabled={formDisabled}
                    onValueChange={value => updateDraft('syntax', value as TopicSyntax)}
                  >
                    <RadioGroupItem value="default" label="V2EX 原生格式" />
                    <RadioGroupItem value="markdown" label="Markdown" />
                  </RadioGroup>
                  <Tooltip content="语法帮助">
                    <a
                      className="create-topic-help-link"
                      href="https://www.v2ex.com/help/markdown"
                      aria-label="语法帮助"
                      onClick={event => handleWebviewLinkClick(event)}
                    >
                      <Info aria-hidden="true" />
                    </a>
                  </Tooltip>
                </div>
              }
              onChange={content => updateDraft('content', content)}
              onPreview={content => vscode.previewTopic(content, draft.syntax)}
              onUploadImage={uploadTopicImage}
              onCheckImgurConnectivity={checkTopicImageConnectivity}
              onUploadingChange={setUploading}
            />
          </section>

          <section className="create-topic-footer">
            <div className="create-topic-node-field">
              <div className="create-topic-node-label">
                <strong>发布到节点</strong>
              </div>
              <div className="create-topic-node-tools">
                <NodeSelectButton
                  ref={nodeSelectRef}
                  node={draft.node}
                  loadNodes={() => vscode.getNodes()}
                  onValueChange={node => updateDraft('node', node)}
                  disabled={formDisabled}
                />
                <a
                  className="create-topic-help-link"
                  href="https://www.v2ex.com/help/node"
                  onClick={event => handleWebviewLinkClick(event)}
                >
                  节点使用说明
                </a>
              </div>
            </div>
            <div className="create-topic-publish">
              <ConfirmPopover
                side="top"
                align="end"
                title="确认发布这个主题？"
                description="发布后 10 分钟内可在话题页修改标题、正文或节点，30 分钟后可添加附言"
                disabled={!canPublish}
                onConfirm={publishTopic}
              >
                <Button
                  className="create-topic-publish-button"
                  variant="primary"
                  icon={<Send aria-hidden="true" />}
                  loading={publishing}
                  disabled={!canPublish}
                >
                  发布主题
                </Button>
              </ConfirmPopover>
            </div>
          </section>
        </div>
      </main>
    </ScrollArea>
  )
}

/**
 * 原样保留主题正文，避免应用回复专用表情转换
 * @param content 主题正文
 */
function preserveContent(content: string): string {
  return content
}

/** 将文件读取为不含 data URL 前缀的 base64 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}
