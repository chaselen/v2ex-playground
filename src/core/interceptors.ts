import type { InternalAxiosRequestConfig } from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import vscode from 'vscode'
import Config from '@/config'
import G from '@/global'

/** GFW 域名缓存 */
const _gfwList: string[] = []

/**
 * Axios GFWList请求代理
 * @param config Axios 请求配置
 */
export function gfwProxyInterceptor(config: InternalAxiosRequestConfig) {
  // 校验代理
  const proxyUrl = Config.proxyUrl()
  if (!proxyUrl) {
    return config
  }
  const isValid = checkProxyUrl(proxyUrl)
  if (!isValid) {
    vscode.window.showErrorMessage('代理url格式不正确')
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
    const fp = path.join(G.context.extensionPath, 'resources', 'gfwlist.txt')
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
