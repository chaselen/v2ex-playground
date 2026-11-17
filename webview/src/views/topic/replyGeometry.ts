/** 连线容器遵循项目的 border-box 约定；还原弹窗缩放前的布局坐标 */
export function getReplyVerticalGeometry(
  element: HTMLElement,
  container: HTMLElement
): { top: number; height: number } {
  const origin = container.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  const layoutHeight = parseFloat(getComputedStyle(container).height)
  const scale = layoutHeight > 0 && origin.height > 0 ? origin.height / layoutHeight : 1
  return { top: (rect.top - origin.top) / scale, height: rect.height / scale }
}
