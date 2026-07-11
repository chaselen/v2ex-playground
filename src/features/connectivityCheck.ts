import axios, { AxiosInstance } from 'axios'
import vscode from 'vscode'
import { logger } from '@/core/logger'

const CHECK_TIMEOUT_MS = 5000
const RETRY_DELAY_MS = 1500
const CONNECTIVITY_CACHE_TTL_MS = 60_000
const RETRY_ACTION = '重试'
const DIAGNOSTICS_ACTION = '查看诊断'

interface ConnectivityTarget {
  id: 'v2ex' | 'imgurImage' | 'imgurApi'
  name: string
  url: string
}

interface ConnectivityResult extends ConnectivityTarget {
  connected: boolean
  detail: string
  elapsedMs: number
}

const targets: ConnectivityTarget[] = [
  { id: 'v2ex', name: 'V2EX', url: 'https://www.v2ex.com/' },
  { id: 'imgurImage', name: 'Imgur 图片', url: 'https://i.imgur.com/' },
  { id: 'imgurApi', name: 'Imgur 上传', url: 'https://api.imgur.com/' }
]
const latestResultById = new Map<ConnectivityTarget['id'], ConnectivityResult>()
const lastCheckedAtById = new Map<ConnectivityTarget['id'], number>()
const pendingProbeById = new Map<ConnectivityTarget['id'], Promise<ConnectivityResult>>()

// 使用独立客户端，避免复用业务请求的 Cookie、拦截器和登录状态
const connectivityHttp = axios.create({
  timeout: CHECK_TIMEOUT_MS,
  withCredentials: false,
  validateStatus: () => true
})

/** 探测目标是否能建立 HTTP 连接，任意 HTTP 响应均视为网络可达 */
async function probeTarget(
  target: ConnectivityTarget,
  http: AxiosInstance
): Promise<ConnectivityResult> {
  const startedAt = Date.now()

  try {
    const response = await http.head(target.url)
    return {
      ...target,
      connected: true,
      detail: `HTTP ${response.status}`,
      elapsedMs: Date.now() - startedAt
    }
  } catch (error) {
    return {
      ...target,
      connected: false,
      detail: describeConnectivityError(error),
      elapsedMs: Date.now() - startedAt
    }
  }
}

/** 复用同一目标尚未完成的检测，并缓存最新结果 */
function probeAndCacheTarget(target: ConnectivityTarget): Promise<ConnectivityResult> {
  const pendingProbe = pendingProbeById.get(target.id)
  if (pendingProbe) {
    return pendingProbe
  }

  const probe = probeTarget(target, connectivityHttp)
    .then(result => {
      cacheConnectivityResults([result])
      return result
    })
    .finally(() => pendingProbeById.delete(target.id))
  pendingProbeById.set(target.id, probe)
  return probe
}

/** 将网络错误转换为不包含请求头等敏感信息的诊断摘要 */
function describeConnectivityError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : '未知错误'
  }

  const code = error.code ? `${error.code}: ` : ''
  return `${code}${error.message}`
}

/** 首次失败后再探测一次，降低扩展刚激活时网络抖动造成的误报 */
async function checkConnectivity(http: AxiosInstance): Promise<ConnectivityResult[]> {
  const firstResults = await Promise.all(
    targets.map(target =>
      http === connectivityHttp ? probeAndCacheTarget(target) : probeTarget(target, http)
    )
  )
  const failedTargets = firstResults.filter(result => !result.connected)
  if (failedTargets.length === 0) {
    cacheConnectivityResults(firstResults)
    return firstResults
  }

  await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
  const retryResults = await Promise.all(
    failedTargets.map(target =>
      http === connectivityHttp ? probeAndCacheTarget(target) : probeTarget(target, http)
    )
  )
  const retryResultById = new Map(retryResults.map(result => [result.id, result]))
  const results = firstResults.map(result => retryResultById.get(result.id) ?? result)
  cacheConnectivityResults(results)
  return results
}

/** 缓存最近一次检测结果，供功能入口按需读取 */
function cacheConnectivityResults(results: ConnectivityResult[]): void {
  const checkedAt = Date.now()
  for (const result of results) {
    latestResultById.set(result.id, result)
    lastCheckedAtById.set(result.id, checkedAt)
  }
}

/**
 * 按需检测 Imgur 指定服务的连通性
 * @param target 服务类型
 * @param refresh 是否忽略短期缓存并立即重新检测
 */
export async function checkImgurConnectivity(
  target: 'image' | 'upload',
  refresh = false
): Promise<boolean> {
  const targetId = target === 'image' ? 'imgurImage' : 'imgurApi'
  const cachedResult = latestResultById.get(targetId)
  const lastCheckedAt = lastCheckedAtById.get(targetId) ?? 0
  if (!refresh && cachedResult && Date.now() - lastCheckedAt < CONNECTIVITY_CACHE_TTL_MS) {
    return cachedResult.connected
  }

  const imgurTarget = targets.find(item => item.id === targetId)!
  const result = await probeAndCacheTarget(imgurTarget)
  return result.connected
}

/** 管理激活后的匿名连通性检查、提示和手动重试 */
class ConnectivityCheckManager {
  private checking = false

  constructor(private readonly output: vscode.OutputChannel) {}

  async run(): Promise<void> {
    if (this.checking) {
      return
    }

    this.checking = true
    try {
      const results = await checkConnectivity(connectivityHttp)
      this.writeDiagnostics(results)
      const unavailableTargets = results.filter(result => !result.connected)
      if (unavailableTargets.length === 0) {
        logger.info('网络连通性检测完成：全部服务可连接')
      } else {
        logger.warn(
          '网络连通性检测完成：部分服务不可连接',
          unavailableTargets.map(result => result.name)
        )
      }
      await this.notifyIfUnavailable(results)
    } catch (error) {
      logger.error('连通性检测失败', error)
    } finally {
      this.checking = false
    }
  }

  private writeDiagnostics(results: ConnectivityResult[]): void {
    this.output.appendLine(`[${new Date().toLocaleString()}] 连通性检测`)
    for (const result of results) {
      const status = result.connected ? '可连接' : '不可连接'
      this.output.appendLine(
        `${result.name}: ${status}（${result.detail}，${result.elapsedMs} ms）`
      )
    }
    this.output.appendLine('')
  }

  private async notifyIfUnavailable(results: ConnectivityResult[]): Promise<void> {
    const v2exResult = results.find(result => result.id === 'v2ex')
    if (!v2exResult || v2exResult.connected) {
      return
    }

    const selection = await vscode.window.showWarningMessage(
      '当前无法连接 V2EX，浏览功能可能不可用',
      RETRY_ACTION,
      DIAGNOSTICS_ACTION
    )

    if (selection === RETRY_ACTION) {
      // 等当前检测结束并释放互斥状态后再开始下一轮
      setTimeout(() => void this.run(), 0)
    } else if (selection === DIAGNOSTICS_ACTION) {
      this.output.show(true)
    }
  }
}

/** 在插件激活后启动不阻塞激活流程的匿名连通性检查 */
export function startConnectivityCheck(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('V2EX 网络诊断')
  context.subscriptions.push(output)

  const manager = new ConnectivityCheckManager(output)
  void manager.run()
}
