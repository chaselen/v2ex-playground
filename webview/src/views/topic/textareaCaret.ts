/** 用相同排版的隐藏文本层测量光标，包含自动换行和文本框内部滚动偏移 */
export function getTextareaCaretRect(textarea: HTMLTextAreaElement): DOMRect {
  const style = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const bounds = textarea.getBoundingClientRect()
  // 只复制影响文字排版的属性，避免继承编辑器的定位、变换或交互样式
  for (const property of [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'font-variant',
    'font-stretch',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'text-align',
    'text-indent',
    'text-transform',
    'direction',
    'tab-size',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width'
  ]) {
    mirror.style.setProperty(property, style.getPropertyValue(property))
  }
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    borderStyle: 'solid',
    boxSizing: 'border-box',
    width: `${textarea.clientWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)}px`
  })
  mirror.textContent = textarea.value.slice(0, textarea.selectionStart)
  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(textarea.selectionStart) || '\u200b'
  mirror.append(marker)
  document.body.append(mirror)
  try {
    const rect = marker.getClientRects()[0]
    return new DOMRect(
      bounds.left + rect.left - textarea.scrollLeft,
      bounds.top + rect.top - textarea.scrollTop,
      0,
      rect.height
    )
  } finally {
    mirror.remove()
  }
}
