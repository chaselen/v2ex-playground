import { Dropdown } from '@douyinfe/semi-ui'
import {
  cloneElement,
  useEffect,
  useState,
  type ComponentProps,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement
} from 'react'

interface ContextMenuTriggerProps {
  /** 已有的右键处理函数 */
  onContextMenu?: MouseEventHandler<HTMLElement>
}

interface TopicShareContextMenuProps {
  /** 触发右键菜单的元素 */
  children: ReactElement<ContextMenuTriggerProps>
  /** 是否禁用右键菜单 */
  disabled?: boolean
  /** 菜单弹出位置 */
  position?: ComponentProps<typeof Dropdown>['position']
  /** 复制链接 */
  onCopyLink: () => void
  /** 复制标题和链接 */
  onCopyTitleLink: () => void
  /** 在浏览器中打开 */
  onViewInBrowser: () => void
}

/**
 * 话题分享右键菜单
 * @param props 组件参数
 */
export default function TopicShareContextMenu(props: TopicShareContextMenuProps) {
  const {
    children,
    disabled = false,
    position = 'bottomLeft',
    onCopyLink,
    onCopyTitleLink,
    onViewInBrowser
  } = props
  const [visible, setVisible] = useState(false)
  const [positionPoint, setPositionPoint] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (disabled) {
      setVisible(false)
    }
  }, [disabled])

  useEffect(() => {
    if (!visible) {
      return
    }

    /** 关闭右键菜单 */
    function closeMenu() {
      setVisible(false)
    }

    /** 页面隐藏时关闭右键菜单 */
    function closeMenuWhenHidden() {
      if (document.hidden) {
        closeMenu()
      }
    }

    window.addEventListener('blur', closeMenu)
    document.addEventListener('click', closeMenu)
    document.addEventListener('visibilitychange', closeMenuWhenHidden)

    return () => {
      window.removeEventListener('blur', closeMenu)
      document.removeEventListener('click', closeMenu)
      document.removeEventListener('visibilitychange', closeMenuWhenHidden)
    }
  }, [visible])

  /**
   * 执行菜单动作并关闭菜单
   * @param action 菜单动作
   */
  function runAction(action: () => void) {
    action()
    setVisible(false)
  }

  /**
   * 在鼠标位置打开右键菜单
   * @param event 鼠标事件
   */
  function openMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    children.props.onContextMenu?.(event)

    if (disabled) {
      return
    }

    setPositionPoint({ x: event.clientX, y: event.clientY })
    setVisible(true)
  }

  const trigger = cloneElement(children, { onContextMenu: openMenu })

  return (
    <>
      {trigger}
      <Dropdown
        clickToHide
        position={position}
        spacing={0}
        trigger="custom"
        visible={visible}
        onVisibleChange={setVisible}
        render={
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => runAction(onCopyLink)}>复制链接</Dropdown.Item>
            <Dropdown.Item onClick={() => runAction(onCopyTitleLink)}>复制标题和链接</Dropdown.Item>
            <Dropdown.Item onClick={() => runAction(onViewInBrowser)}>在浏览器中打开</Dropdown.Item>
          </Dropdown.Menu>
        }
      >
        <span
          aria-hidden
          style={{
            position: 'fixed',
            top: positionPoint.y,
            left: positionPoint.x,
            width: 0,
            height: 0,
            pointerEvents: 'none'
          }}
        />
      </Dropdown>
    </>
  )
}
