import type { CSSProperties, HTMLAttributes } from 'react'
import { mergeClassNames } from './utils'

interface SkeletonRootProps extends HTMLAttributes<HTMLDivElement> {
  /** 是否播放骨架渐变动画 */
  active?: boolean
}

interface SkeletonParagraphProps extends HTMLAttributes<HTMLDivElement> {
  /** 占位行数量 */
  rows?: number
}

interface SkeletonAvatarProps extends HTMLAttributes<HTMLDivElement> {
  /** 头像尺寸 */
  size?: 'extra-extra-small' | 'small' | 'default' | 'large'
  /** 头像形状 */
  shape?: 'circle' | 'square'
}

function SkeletonRoot({ active = false, className, ...props }: SkeletonRootProps) {
  return (
    <div
      {...props}
      className={mergeClassNames('v2ex-skeleton', active && 'v2ex-skeleton--active', className)}
    />
  )
}

function SkeletonTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={mergeClassNames('v2ex-skeleton__title', className)} />
}

function SkeletonParagraph({ className, rows = 3, style, ...props }: SkeletonParagraphProps) {
  return (
    <div
      {...props}
      className={mergeClassNames('v2ex-skeleton__paragraph', className)}
      style={style}
    >
      {Array.from({ length: rows }, (_, index) => (
        <span
          className="v2ex-skeleton__line"
          style={
            index === rows - 1 && rows > 1
              ? ({ '--v2ex-skeleton-line-width': '72%' } as CSSProperties)
              : undefined
          }
          key={index}
        />
      ))}
    </div>
  )
}

function SkeletonButton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={mergeClassNames('v2ex-skeleton__button', className)} />
}

function SkeletonAvatar({
  className,
  shape = 'circle',
  size = 'default',
  ...props
}: SkeletonAvatarProps) {
  return (
    <div
      {...props}
      className={mergeClassNames(
        'v2ex-skeleton__avatar',
        `v2ex-skeleton__avatar--${size}`,
        `v2ex-skeleton__avatar--${shape}`,
        className
      )}
    />
  )
}

/** 结构化页面骨架所用的轻量占位组件 */
export const Skeleton = Object.assign(SkeletonRoot, {
  Avatar: SkeletonAvatar,
  Button: SkeletonButton,
  Paragraph: SkeletonParagraph,
  Title: SkeletonTitle
})
