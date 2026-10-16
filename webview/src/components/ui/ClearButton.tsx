import { X } from 'lucide-react'

/** 输入与选择控件共用的清除操作，保持独立按钮以支持键盘访问 */
export function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      className="v2ex-control-clear"
      type="button"
      aria-label={label}
      onPointerDown={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        // 清空后按钮可能卸载，将键盘焦点交还输入框或选择触发器
        event.currentTarget.parentElement?.querySelector<HTMLElement>('input, button')?.focus()
        onClear()
      }}
    >
      <X aria-hidden="true" />
    </button>
  )
}
