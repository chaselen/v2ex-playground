import { Tag, type TagProps } from '@/components/ui'

/** 使用 VS Code Badge Theme Color 的 PRO 标签 */
export default function ProTag(props: Omit<TagProps, 'children' | 'variant'>) {
  return (
    <Tag {...props} variant="badge">
      PRO
    </Tag>
  )
}
