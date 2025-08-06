import axios from 'axios'
import G from './global'
import Config from './config'
import vscode from 'vscode'
import path from 'node:path'
import fs from 'node:fs'

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
  const reqUrl = new URL(config.url || '', config.baseURL)
  const hosts = getGfwHostList()

  // 添加v2ex的cookie
  if (reqUrl.host.endsWith('v2ex.com')) {
    if (config.headers['Cookie'] === undefined) {
      config.headers['Cookie'] = G.getCookie() || ''
    }
  }

  // 设置代理
  if (hosts.some(host => reqUrl.host.endsWith(host))) {
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

const _gfwList: string[] = []

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

export default http
