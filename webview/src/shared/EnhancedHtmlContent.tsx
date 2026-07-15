import { createElement, useLayoutEffect, useMemo, useRef, type HTMLAttributes } from 'react'
import { enhanceHtmlContent, normalizeHtml } from './contentEnhancement'

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
}

/**
 * 渲染并增强来自 V2EX 的 HTML 内容
 */
export default function EnhancedHtmlContent({
  as = 'div',
  html,
  showImages = true,
  ...elementProps
}: EnhancedHtmlContentProps) {
  const rootRef = useRef<HTMLElement>(null)
  const normalizedHtml = useMemo(
    () => normalizeHtml(html, { loadImages: showImages }),
    [html, showImages]
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    if (root) {
      enhanceHtmlContent(root, showImages)
    }
  }, [normalizedHtml, showImages])

  return createElement(as, {
    ...elementProps,
    ref: rootRef,
    dangerouslySetInnerHTML: { __html: normalizedHtml }
  })
}
