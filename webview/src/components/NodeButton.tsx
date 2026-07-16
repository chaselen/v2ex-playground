import { Button } from '@douyinfe/semi-ui'
import type { BaseButtonProps } from '@douyinfe/semi-ui/lib/es/button'

/** 节点按钮属性 */
type NodeButtonProps = Omit<BaseButtonProps, 'size' | 'type'>

/**
 * 使用统一轻量样式的节点按钮
 * @param props Semi Button 属性
 */
export default function NodeButton(props: NodeButtonProps) {
  return <Button {...props} size="small" type="tertiary" />
}
