import { Badge, Tag } from '@douyinfe/semi-ui'
import type { BadgeProps } from '@douyinfe/semi-ui/lib/es/badge'
import type { TagProps } from '@douyinfe/semi-ui/lib/es/tag/interface'

/** 合并可选类名 */
function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

/**
 * 使用 VS Code 中性标签配色的 Semi Tag
 * @param props Semi Tag 参数
 */
export function VscodeTag(props: TagProps) {
  return <Tag {...props} className={mergeClassNames('vscode-tag', props.className)} />
}

/**
 * 使用 VS Code Badge Theme Color 的 PRO 标签
 * @param props Semi Tag 参数
 */
export function VscodeProTag(props: Omit<TagProps, 'children' | 'size'>) {
  return (
    <Tag {...props} className={mergeClassNames('vscode-pro-tag', props.className)} size="small">
      PRO
    </Tag>
  )
}

/**
 * 使用 VS Code Badge Theme Color 的 Semi Badge
 * @param props Semi Badge 参数
 */
export function VscodeBadge(props: BadgeProps) {
  return (
    <Badge
      {...props}
      countClassName={mergeClassNames('vscode-badge-count', props.countClassName)}
      countStyle={{
        backgroundColor: 'var(--vscode-badge-background, var(--semi-color-danger))',
        color: 'var(--vscode-badge-foreground, #fff)',
        ...props.countStyle
      }}
    />
  )
}
