import type { MouseEvent } from 'react'
import type { MainViewRpcCommands } from '@extension/shared/webview'
import { VscodeBadge } from '@/components/SemiVscode'
import TopicShareContextMenu from '@/components/TopicShareContextMenu'
import { createVsCodeClient } from '@/core/vscode'
import styles from './TopicRow.module.scss'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands>()

/** 主题右键菜单动作 */
type TopicContextMenuAction = 'copyLink' | 'copyTitleLink' | 'viewInBrowser'

/** 右键菜单命令映射 */
const contextMenuCommands: Record<
  TopicContextMenuAction,
  'ctxCopyLink' | 'ctxCopyTitleLink' | 'ctxViewInBrowser'
> = {
  copyLink: 'ctxCopyLink',
  copyTitleLink: 'ctxCopyTitleLink',
  viewInBrowser: 'ctxViewInBrowser'
}

interface TopicRowProps {
  /** 主题 id */
  topicId: number
  /** 主题标题 */
  title: string
  /** 回复数 */
  replies?: number
  /** 渲染元素 */
  as?: 'div' | 'button'
  /** 附加类名 */
  className?: string
  /** 是否点击时打开主题 */
  openOnClick?: boolean
  /** 是否已读 */
  isRead?: boolean
}

/**
 * 主题行
 * @param props 组件参数
 */
export default function TopicRow(props: TopicRowProps) {
  const { topicId, title, replies, as = 'div', className, openOnClick = true, isRead } = props

  /**
   * 打开主题
   * @param event 鼠标事件
   */
  function openTopic(event: MouseEvent<HTMLElement>) {
    event.stopPropagation()
    vscode.openTopic({ topicId, title })
  }

  /**
   * 发送右键菜单命令
   * @param action 菜单动作
   */
  function postContextMenuCommand(action: TopicContextMenuAction) {
    vscode[contextMenuCommands[action]]({
      topicId,
      label: title
    })
  }

  const content = (
    <>
      <span className={styles['topic-title']}>{title}</span>
      {!!replies && replies > 0 && <VscodeBadge count={replies} overflowCount={99} />}
    </>
  )
  const rowClassName = [styles['topic-row'], isRead ? styles['topic-row--read'] : '', className]
    .filter(Boolean)
    .join(' ')
  const row =
    as === 'button' ? (
      <button
        type="button"
        className={rowClassName}
        title={title}
        onClick={openOnClick ? openTopic : undefined}
      >
        {content}
      </button>
    ) : (
      <div className={rowClassName} title={title} onClick={openOnClick ? openTopic : undefined}>
        {content}
      </div>
    )

  return (
    <TopicShareContextMenu
      onCopyLink={() => postContextMenuCommand('copyLink')}
      onCopyTitleLink={() => postContextMenuCommand('copyTitleLink')}
      onViewInBrowser={() => postContextMenuCommand('viewInBrowser')}
    >
      {row}
    </TopicShareContextMenu>
  )
}
