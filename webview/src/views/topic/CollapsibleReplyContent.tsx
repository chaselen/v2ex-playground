import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui'
import { mergeClassNames } from '@/components/ui/utils'
import { shouldCollapseReplyContent } from './collapsibleReply'

/** 折叠展示状态：未折叠 / 收起 / 展开 */
type CollapseMode = 'idle' | 'collapsed' | 'expanded'

/** 可折叠回复内容属性 */
export interface CollapsibleReplyContentProps {
  /** 回复正文 */
  children: ReactNode
  /** 用于在内容变化时重新判定的键，通常为回复 HTML */
  contentKey: string
  /**
   * 是否显示帖子图片
   *
   * 对应 `v2ex.browse.showImagesInTopic`。关闭时按隐藏图片后的实际高度判定，
   * 切换后会重新测量，不沿用上一模式的折叠状态。
   */
  showImages: boolean
}

/**
 * 过长回复默认收起，可展开 / 收起
 *
 * 仅包裹话题回复；正文、附言与分享图中的回复不使用此组件。
 * 是否折叠以当前可见内容的实测高度为准；图片加载与代码高亮等异步增高
 * 通过 ResizeObserver 再次判定，用户手动展开 / 收起后不再自动改写状态。
 */
export default function CollapsibleReplyContent({
  children,
  contentKey,
  showImages
}: CollapsibleReplyContentProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const userToggledRef = useRef(false)
  const [mode, setMode] = useState<CollapseMode>('idle')

  useLayoutEffect(() => {
    userToggledRef.current = false
    setMode('idle')

    const body = bodyRef.current
    if (!body) {
      return
    }

    let cancelled = false

    /** 根据当前可见内容高度判定是否需要默认收起 */
    function evaluate() {
      if (cancelled || userToggledRef.current || !body) {
        return
      }
      setMode(shouldCollapseReplyContent(body) ? 'collapsed' : 'idle')
    }

    evaluate()

    // 覆盖图片加载、语法高亮等异步增高；隐藏图片时占位变化也会触发
    const resizeObserver = new ResizeObserver(() => {
      evaluate()
    })
    resizeObserver.observe(body)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
    }
  }, [contentKey, showImages])

  /**
   * 切换展开 / 收起
   * @param event 点击事件
   */
  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    userToggledRef.current = true
    setMode(current => (current === 'collapsed' ? 'expanded' : 'collapsed'))
  }

  const showToggle = mode === 'collapsed' || mode === 'expanded'

  return (
    <div
      className={mergeClassNames(
        'v2ex-collapsible-reply',
        mode === 'collapsed' && 'v2ex-collapsible-reply--collapsed',
        mode === 'expanded' && 'v2ex-collapsible-reply--expanded'
      )}
    >
      <div className="v2ex-collapsible-reply__body" ref={bodyRef}>
        {children}
      </div>
      {showToggle && (
        <Button
          aria-expanded={mode === 'expanded'}
          className="v2ex-collapsible-reply__toggle"
          size="small"
          variant="secondary"
          onClick={handleToggle}
        >
          {mode === 'collapsed' ? '展开回复' : '收起回复'}
        </Button>
      )}
    </div>
  )
}
