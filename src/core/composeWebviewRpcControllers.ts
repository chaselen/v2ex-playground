import { WEBVIEW_RPC_METHOD_PREFIX } from '@/shared/webviewRpc'

type RpcMethods<Controller> = Pick<Controller, Extract<keyof Controller, `rpc_${string}`>>

type ComposedRpcControllers<Controllers extends readonly object[]> = Controllers extends readonly [
  infer First,
  ...infer Rest extends readonly object[]
]
  ? RpcMethods<First> & ComposedRpcControllers<Rest>
  : unknown

/** 合并 RPC 处理器并保留各自的 this；重复命令在注册时抛错 */
export function composeWebviewRpcControllers<Controllers extends readonly object[]>(
  ...controllers: Controllers
): ComposedRpcControllers<Controllers> {
  const handlers = Object.create(null) as Record<string, (...args: unknown[]) => unknown>
  for (const controller of controllers) {
    const visited = new Set<string>()
    let prototype: object | null = controller
    while (prototype && prototype !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (!name.startsWith(WEBVIEW_RPC_METHOD_PREFIX) || visited.has(name)) continue
        visited.add(name)
        const method = Object.getOwnPropertyDescriptor(prototype, name)?.value
        if (typeof method !== 'function') continue
        if (Object.hasOwn(handlers, name)) {
          throw new Error(
            `重复的 Webview RPC 处理器: ${name.slice(WEBVIEW_RPC_METHOD_PREFIX.length)}`
          )
        }
        handlers[name] = method.bind(controller)
      }
      prototype = Object.getPrototypeOf(prototype)
    }
  }
  return handlers as ComposedRpcControllers<Controllers>
}
