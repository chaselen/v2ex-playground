/** 合并可选类名 */
export function mergeClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

/** 为 Base UI 的静态类名或状态回调添加共享组件类名 */
export function withBaseClassName<State>(
  base: string,
  className: string | ((state: State) => string | undefined) | undefined
) {
  return typeof className === 'function'
    ? (state: State) => mergeClassNames(base, className(state))
    : mergeClassNames(base, className)
}

/** 组合触发器关闭后聚焦内层按钮，避免焦点落在包裹 span 上并出现浏览器默认描边 */
export function getTriggerFocusTarget(trigger: HTMLElement | null) {
  return trigger?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? trigger
}
