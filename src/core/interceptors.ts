import type { InternalAxiosRequestConfig } from 'axios'
import fs from 'node:fs'
import path from 'node:path'

/** GFW 域名缓存 */
const _gfwList: string[] = []

/**
 * 创建GFW代理请求拦截器
 * @param proxyUrl 返回代理URL，无代理时返回 undefined
 */
export function createGfwProxyInterceptor(getProxyUrl: () => string | undefined) {
  return function (config: InternalAxiosRequestConfig) {
    const proxyUrl = getProxyUrl()
    if (!proxyUrl) {
      return config
    }
    if (!checkProxyUrl(proxyUrl)) {
      console.error('代理url格式不正确')
      return config
    }

    // 匹配gfwlist
    const reqUrl = new URL(config.url || '', config.baseURL)
    const hosts = getGfwHostList()
    if (!hosts.some(host => reqUrl.host.endsWith(host))) {
      return config
    }

    // 设置代理
    const url = new URL(proxyUrl)
    config.proxy = {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: Number(url.port)
    }

    return config
  }
}

/** 代理URL格式校验 */
function checkProxyUrl(url: string) {
  if (url) {
    const regex = /^(http|https|socks|socks5|socks5h):\/\/(.+):(\d+)$/gm
    const match = regex.exec(url)
    if (!match) {
      return false
    }
  }
  return true
}

/** 解析gfwlist */
function getGfwHostList() {
  if (_gfwList.length <= 0) {
    console.log('加载gfw列表...')
    const fp = path.resolve(__dirname, '../../resources/gfwlist.txt')
    let str = fs.readFileSync(fp, 'utf-8')
    // base64解码
    str = Buffer.from(str, 'base64').toString('utf-8')
    // 解析gfwlist
    const lines = str.split('\n')
    for (const line of lines) {
      if (line.startsWith('||')) {
        _gfwList.push(line.substring(2))
      }
      if (line.startsWith('.')) {
        _gfwList.push(line.substring(1))
      }
    }
    console.log(`gfw列表加载完成，共${_gfwList.length}个域名`)
  }
  return _gfwList
}
