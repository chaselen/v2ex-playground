import { Button, type ButtonProps } from '@/components/ui'

/** 节点按钮属性 */
type NodeButtonProps = Omit<ButtonProps, 'size' | 'variant'>

/**
 * 使用统一轻量样式的节点按钮
 * @param props 按钮属性
 */
export default function NodeButton(props: NodeButtonProps) {
  return <Button {...props} size="small" variant="subtle" />
}
