import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

/** HTTP 请求失败摘要，不包含查询参数、请求头和请求正文 */
export interface HttpFailureSummary {
  method: string
  target: string
  status?: number
  elapsedMs?: number
}

/** HTTP 请求失败回调 */
export type HttpFailureHandler = (summary: HttpFailureSummary) => void

/** 获取不包含查询参数和凭据的请求目标 */
function getSafeRequestTarget(config: InternalAxiosRequestConfig): string {
  try {
    const url = new URL(config.url || '', config.baseURL)
    return `${url.hostname}${url.pathname}`
  } catch {
    return (config.url || '未知地址').split('?')[0]
  }
}

/** 为 Axios 客户端注册脱敏的请求失败摘要 */
export function installHttpFailureLogging(
  http: AxiosInstance,
  onFailure: HttpFailureHandler
): void {
  const startedAtByConfig = new WeakMap<InternalAxiosRequestConfig, number>()

  http.interceptors.request.use(config => {
    startedAtByConfig.set(config, Date.now())
    return config
  })
  http.interceptors.response.use(
    response => {
      startedAtByConfig.delete(response.config)
      return response
    },
    error => {
      if (axios.isAxiosError(error) && error.config) {
        const startedAt = startedAtByConfig.get(error.config)
        onFailure({
          method: (error.config.method || 'GET').toUpperCase(),
          target: getSafeRequestTarget(error.config),
          status: error.response?.status,
          elapsedMs: startedAt === undefined ? undefined : Date.now() - startedAt
        })
        startedAtByConfig.delete(error.config)
      }
      return Promise.reject(error)
    }
  )
}
