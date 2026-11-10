import http, { type IncomingMessage, type RequestOptions } from 'node:http'
import https from 'node:https'

/**
 * 禁止自动重定向的原生传输，连接前与 Axios 使用相同超时
 * 不替换 Agent，保留宿主对 HTTP 模块和代理的接管
 */
export function createNativeHttpTransport(timeoutMs: number) {
  return {
    request(options: RequestOptions, callback: (response: IncomingMessage) => void) {
      const transport = options.protocol === 'https:' ? https : http
      // req.setTimeout 要等连接建立才应用；在创建 Socket 时覆盖 Agent 默认的 5 秒
      const request = transport.request({ ...options, timeout: timeoutMs }, callback)
      // 自定义 transport 不经过 Axios 的原生连接计时，补齐 DNS / 代理解析等待
      const timer = setTimeout(() => request.emit('timeout'), timeoutMs)
      const clearTimer = () => clearTimeout(timer)
      request.once('response', clearTimer)
      request.once('error', clearTimer)
      request.once('close', clearTimer)
      return request
    }
  }
}
