import { createElement, useLayoutEffect, useMemo, useRef, type HTMLAttributes } from 'react'
import { enhanceHtmlContent, normalizeHtml } from '@/core/contentEnhancement'
import type { OpenTopicPreview } from '@/core/contentEnhancement'
import { useImagePreview } from '@/components/ImagePreviewProvider'

/** HTML 内容容器支持的标签 */
type HtmlContentElement = 'div' | 'section'

/** 增强 HTML 内容属性 */
interface EnhancedHtmlContentProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'dangerouslySetInnerHTML'
> {
  /** 容器标签 */
  as?: HtmlContentElement
  /** 原始 HTML */
  html?: unknown
  /** 是否显示并加载图片 */
  showImages?: boolean
  /** 打开内容中的站内话题预览 */
  onTopicPreview?: OpenTopicPreview
}

/**
 * 渲染并增强来自 V2EX 的 HTML 内容
 */
export default function EnhancedHtmlContent({
  as = 'div',
  html,
  showImages = true,
  onTopicPreview,
  ...elementProps
}: EnhancedHtmlContentProps) {
  const rootRef = useRef<HTMLElement>(null)
  const openImagePreview = useImagePreview()
  const normalizedHtml = useMemo(
    () => normalizeHtml(html, { loadImages: showImages }),
    [html, showImages]
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    if (root) {
      // React 重写 innerHTML 后需恢复运行时插入的按钮和事件监听
      enhanceHtmlContent(root, showImages, openImagePreview, onTopicPreview)
    }
  })

  return createElement(as, {
    ...elementProps,
    ref: rootRef,
    dangerouslySetInnerHTML: { __html: normalizedHtml }
  })
}
