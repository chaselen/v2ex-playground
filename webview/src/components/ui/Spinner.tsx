import { LoaderCircle } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { mergeClassNames } from './utils'

/** 使用 VS Code 进度色的加载指示 */
export function Spinner({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={mergeClassNames('v2ex-spinner', className)}
      role="status"
      aria-label={props['aria-label'] ?? '加载中'}
    >
      <LoaderCircle aria-hidden="true" />
    </span>
  )
}
