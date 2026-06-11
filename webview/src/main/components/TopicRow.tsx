import { Badge, Dropdown } from '@douyinfe/semi-ui'
import type { MainViewRpcCommands } from '../../../../src/shared/webview'
import { createVsCodeClient } from '../../shared/vscode'
import styles from './TopicRow.module.scss'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands>()

/** 主题右键菜单动作 */
type TopicContextMenuAction = 'copyLink' | 'copyTitleLink' | 'viewInBrowser'

/** 右键菜单项 */
const contextMenuItems: Array<{ action: TopicContextMenuAction; label: string }> = [
  { action: 'copyLink', label: '复制链接' },
  { action: 'copyTitleLink', label: '复制标题和链接' },
  { action: 'viewInBrowser', label: '在浏览器中打开' }
]

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
}

/**
 * 主题行
 * @param props 组件参数
 */
export default function TopicRow(props: TopicRowProps) {
  const { topicId, title, replies, as = 'div', className, openOnClick = true } = props

  /**
   * 打开主题
   */
  function openTopic() {
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
      {!!replies && replies > 0 && (
        <Badge
          count={replies}
          overflowCount={99}
          countClassName={styles['topic-badge-count']}
          countStyle={{
            backgroundColor: 'var(--vscode-badge-background)',
            color: 'var(--vscode-badge-foreground)'
          }}
        />
      )}
    </>
  )
  const rowClassName = [styles['topic-row'], className].filter(Boolean).join(' ')
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

  const menu = (
    <Dropdown.Menu>
      {contextMenuItems.map(item => (
        <Dropdown.Item key={item.action} onClick={() => postContextMenuCommand(item.action)}>
          {item.label}
        </Dropdown.Item>
      ))}
    </Dropdown.Menu>
  )

  return (
    <Dropdown trigger="contextMenu" position="bottomLeft" clickToHide render={menu}>
      {row}
    </Dropdown>
  )
}
