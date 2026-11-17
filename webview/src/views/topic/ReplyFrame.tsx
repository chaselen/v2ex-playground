import type { ReactNode } from 'react'
import { mergeClassNames } from '@/components/ui/utils'

interface ReplyFrameProps {
  avatar?: ReactNode
  author: ReactNode
  metadata: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}

/** 话题页和分享图共用头像列、元信息与正文起点，具体内容和操作由调用方提供 */
export default function ReplyFrame({
  avatar,
  author,
  metadata,
  actions,
  className,
  children
}: ReplyFrameProps) {
  return (
    <article className={mergeClassNames('reply-layout', className)}>
      {avatar}
      <div className="reply-body">
        <header className="reply-meta">
          {author}
          {metadata}
          {actions && <div className="reply-actions">{actions}</div>}
        </header>
        {children}
      </div>
    </article>
  )
}
