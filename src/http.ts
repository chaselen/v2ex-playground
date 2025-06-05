import axios from 'axios'
import G from './global'
import Config from './config'
import vscode from 'vscode'

const http = axios.create({
  baseURL: 'https://www.v2ex.com',
  headers: {
    // 需要用一个合法的UA，否则访问某些页面会出错
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  },
  timeout: 15000
})

http.interceptors.request.use(config => {
  if (config.headers['Cookie'] === undefined) {
    config.headers['Cookie'] = G.getCookie() || ''
  }
  const proxyUrl = Config.proxyUrl()
  if (proxyUrl) {
    const isValid = checkProxyUrl(proxyUrl)
    if (isValid) {
      const url = new URL(proxyUrl)
      config.proxy = {
        protocol: url.protocol.replace(':', ''),
        host: url.hostname,
        port: Number(url.port)
      }
    } else {
      vscode.window.showErrorMessage('代理url格式不正确')
    }
  }
  return config
})

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

export default http
