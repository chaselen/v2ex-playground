let initialized = false

/**
 * 记录当前文档的输入方式，避免浮层恢复焦点时沿用之前的键盘焦点描边
 * 监听器与 Webview 文档同生命周期；只控制按钮类控件，不影响文本输入的焦点提示
 */
export function initializeFocusVisibility() {
  if (initialized) return
  initialized = true

  document.addEventListener(
    'pointerdown',
    () => {
      document.documentElement.setAttribute('data-v2ex-pointer-interaction', '')
    },
    true
  )
  document.addEventListener(
    'keydown',
    event => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        // Esc 只关闭浮层，不改变打开前的输入方式
        ['Escape', 'Shift', 'Alt', 'Control', 'Meta'].includes(event.key)
      )
        return
      document.documentElement.removeAttribute('data-v2ex-pointer-interaction')
    },
    true
  )
}
