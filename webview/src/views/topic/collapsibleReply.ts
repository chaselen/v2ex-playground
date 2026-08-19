/**
 * 收起态最大可见高度（px）
 *
 * 需与 `topic.scss` 中 `.v2ex-collapsible-reply--collapsed` 的 max-height 保持一致。
 */
export const COLLAPSED_REPLY_MAX_HEIGHT = 280

/**
 * 内容需超出收起窗口的最小高度（px）
 *
 * 以实测高度为准：只有明显溢出时才折叠，避免临界高度反复切换。
 */
export const REPLY_COLLAPSE_OVERFLOW_THRESHOLD = 100

/**
 * 根据实测高度判断是否应默认收起
 * @param contentHeight 内容完整高度
 */
export function shouldCollapseReplyContentFromMetrics(contentHeight: number): boolean {
  return contentHeight >= COLLAPSED_REPLY_MAX_HEIGHT + REPLY_COLLAPSE_OVERFLOW_THRESHOLD
}

/**
 * 是否应将回复默认收起
 * @param root 回复内容根节点
 * @param contentHeight 已测量的内容高度；省略时使用 scrollHeight
 */
export function shouldCollapseReplyContent(
  root: HTMLElement,
  contentHeight = root.scrollHeight
): boolean {
  return shouldCollapseReplyContentFromMetrics(contentHeight)
}
