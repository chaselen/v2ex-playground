import NodeSelectButton from '@/components/NodeSelectButton'
import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { getV2exNodeAvatarUrl } from '@extension/features/nodeAvatars'
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  Input,
  RadioGroup,
  RadioGroupItem,
  Toast
} from '@/components/ui'
import PageSkeleton from '@/components/PageSkeleton'
import { createVsCodeClient } from '@/core/vscode'
import ReplyComposer from './ReplyComposer'
import type {
  Node,
  TopicContentAction,
  TopicContentInput,
  TopicContentState,
  TopicSyntax
} from '@extension/v2ex/types'
import type { TopicPanelRpcCommands } from '@extension/shared/topicView'
import styles from './TopicContentDialog.module.scss'

const vscode = createVsCodeClient<TopicPanelRpcCommands>()

/** 主题内容操作名称 */
export const topicContentLabels: Record<TopicContentAction, string> = {
  edit: '修改主题',
  move: '移动主题',
  append: '添加附言'
}

/** 主题内容操作表单，附言校验期间保留用户输入 */
export default function TopicContentDialog({
  action,
  currentNode,
  onClose
}: {
  action: TopicContentAction
  currentNode: Node
  onClose: () => void
}) {
  const [values, setValues] = useState<TopicContentState>({
    title: '',
    content: '',
    syntax: 'default',
    nodeName: ''
  })
  const [targetNode, setTargetNode] = useState<Node>(currentNode)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true
    vscode
      .prepareTopicContent(action)
      .then(next => {
        if (!active) return
        // 附言没有原文需要恢复，后台响应不得覆盖用户提前输入的内容
        if (action !== 'append') setValues(next)
        setReady(true)
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      active = false
    }
  }, [action])

  function change<Key extends keyof TopicContentState>(name: Key, value: TopicContentState[Key]) {
    setValues(current => ({ ...current, [name]: value }))
  }

  const disabled = busy || uploading || submitted
  const editorDisabled = busy || submitted || (action !== 'append' && !ready)
  const invalid =
    !ready ||
    (action === 'move'
      ? !values.nodeName.trim()
      : action === 'append'
        ? !values.content.trim()
        : !values.title.trim())

  async function submit() {
    if (disabled || invalid) return
    setBusy(true)
    setError('')
    const input: TopicContentInput =
      action === 'move'
        ? { action, nodeName: values.nodeName }
        : action === 'edit'
          ? { action, title: values.title, content: values.content, syntax: values.syntax }
          : { action, content: values.content, syntax: values.syntax }
    try {
      await vscode.updateTopicContent(input)
      Toast.success('主题已更新')
      onClose()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message)
      // 写入成功但刷新失败时，禁止在当前对话框重复提交
      if (message.includes('操作已提交')) setSubmitted(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      title={topicContentLabels[action]}
      closeOnOverlayClick={false}
      onOpenChange={open => {
        if (!open && !busy && !uploading) onClose()
      }}
      footer={
        <>
          <Button disabled={busy || uploading} onClick={onClose}>
            关闭
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={disabled || invalid}
            onClick={() => void submit()}
          >
            提交
          </Button>
        </>
      }
    >
      <div className={`${styles.form} ${action === 'append' ? styles.appendForm : ''}`}>
        {error && <Alert variant="danger" title="操作失败" description={error} />}
        {action === 'edit' && !ready ? (
          !error && <PageSkeleton variant="topic" />
        ) : (
          <>
            {action === 'edit' && (
              <div className={styles.field}>
                <label htmlFor="topic-content-title">标题</label>
                <Input
                  id="topic-content-title"
                  value={values.title}
                  disabled={disabled}
                  onValueChange={value => change('title', value)}
                />
              </div>
            )}
            {action === 'move' ? (
              <>
                <div className={styles.field}>
                  <span>当前所在节点</span>
                  <div className={styles.currentNode}>
                    <Avatar
                      className={styles.nodeAvatar}
                      src={currentNode.avatar || getV2exNodeAvatarUrl(currentNode.name)}
                      alt=""
                      shape="square"
                      fallback={<MapPin aria-hidden="true" />}
                    />
                    <span>{currentNode.title}</span>
                    <span className={styles.nodeName}>{currentNode.name}</span>
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="topic-content-node">目标节点</label>
                  <NodeSelectButton
                    id="topic-content-node"
                    node={targetNode}
                    disabled={disabled || !ready}
                    onClick={async () => {
                      try {
                        const node = await vscode.pickTopicContentNode(targetNode.name)
                        if (node) {
                          setTargetNode(node)
                          change('nodeName', node.name)
                        }
                      } catch (reason) {
                        setError(reason instanceof Error ? reason.message : String(reason))
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <div className={styles.field}>
                <ReplyComposer
                  autoFocus
                  className={styles.composer}
                  showImages
                  value={values.content}
                  onChange={content => change('content', content)}
                  maxLength={null}
                  resetKey={values.syntax}
                  placeholder={action === 'append' ? '附言内容' : '主题正文'}
                  previewAriaLabel="生成主题内容预览"
                  transformContent={content => content}
                  disabled={editorDisabled}
                  showEmoticons={false}
                  rows={10}
                  toolbarClassName={styles.editorToolbar}
                  toolbarEnd={
                    <RadioGroup
                      className={styles.syntax}
                      variant="segmented"
                      aria-label="文本标记语法"
                      value={values.syntax}
                      disabled={disabled || editorDisabled}
                      onValueChange={value => change('syntax', value as TopicSyntax)}
                    >
                      <RadioGroupItem value="default" label="V2EX 原生格式" />
                      <RadioGroupItem value="markdown" label="Markdown" />
                    </RadioGroup>
                  }
                  onUploadingChange={setUploading}
                  onPreview={content =>
                    vscode.previewTopicContent({ content, syntax: values.syntax })
                  }
                />
              </div>
            )}
          </>
        )}
        <aside className={styles.rules} aria-label="操作说明">
          <strong>
            {action === 'append'
              ? '关于添加附言'
              : action === 'move'
                ? '关于移动主题'
                : '关于编辑主题'}
          </strong>
          {action === 'append' ? (
            <ul>
              <li>请在确有必要的情况下再使用此功能为原主题补充信息</li>
              <li>每个主题至多可以附加 3 条附言</li>
              <li>创建附言价格为每千字 20 铜币</li>
            </ul>
          ) : (
            <p>主题在创建之后的 10 分钟内，可以被自由修改和移动。超过 10 分钟之后，将不能修改。</p>
          )}
        </aside>
      </div>
    </Dialog>
  )
}
