import { UserRound } from 'lucide-react'
import { Avatar as AvatarPrimitive } from 'radix-ui'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { mergeClassNames } from './utils'

export interface AvatarProps extends Omit<
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
  'children'
> {
  /** 头像地址 */
  src?: string
  /** 图片替代文本 */
  alt?: string
  /** 头像尺寸 */
  size?: 'small' | 'default' | 'large'
  /** 头像形状 */
  shape?: 'circle' | 'square'
  /** 图片不可用时的回退内容 */
  fallback?: ReactNode
}

/** 基于 Radix Avatar、适配 VS Code 主题的头像 */
export function Avatar({
  alt = '',
  className,
  fallback,
  shape = 'circle',
  size = 'default',
  src,
  ...props
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      {...props}
      className={mergeClassNames(
        'v2ex-avatar',
        `v2ex-avatar--${size}`,
        `v2ex-avatar--${shape}`,
        className
      )}
    >
      {src && <AvatarPrimitive.Image className="v2ex-avatar__image" src={src} alt={alt} />}
      <AvatarPrimitive.Fallback className="v2ex-avatar__fallback" delayMs={120}>
        {fallback ?? <UserRound aria-hidden="true" />}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
