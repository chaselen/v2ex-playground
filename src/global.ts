import type { V2exClient } from '@/v2ex'
import { ExtensionContext } from 'vscode'

export default class G {
  /** 插件上下文，在插件激活时赋值 */
  static context: ExtensionContext
  /** V2EX API 客户端，在插件激活时赋值 */
  static V2ex: V2exClient
}
