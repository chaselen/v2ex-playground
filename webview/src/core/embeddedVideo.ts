/** 嵌入视频信息 */
export interface EmbeddedVideoInfo {
  /** 适合在浏览器中打开的地址 */
  externalUrl: string
  /** 视频来源域名 */
  source: string
}

/**
 * 获取适合在浏览器中打开的视频地址
 *
 * VS Code Webview 的 sandbox 会阻止嵌入播放器内部打开新窗口，因此已知视频站点的
 * embed 地址需要转换为普通观看页，再通过扩展的外部打开能力交给系统浏览器。
 *
 * @example
 * getExternalVideoUrl(new URL('https://www.youtube.com/embed/YhxnffqiegU'))
 * // => 'https://www.youtube.com/watch?v=YhxnffqiegU'
 *
 * @param url 视频嵌入地址
 */
function getExternalVideoUrl(url: URL): string {
  const hostname = url.hostname.replace(/^www\./i, '')
  const youtubeVideoId = url.pathname.match(/^\/embed\/([^/]+)/)?.[1]
  if ((hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') && youtubeVideoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}`
  }

  const vimeoVideoId = url.pathname.match(/^\/video\/(\d+)/)?.[1]
  if (hostname === 'player.vimeo.com' && vimeoVideoId) {
    return `https://vimeo.com/${vimeoVideoId}`
  }

  return url.toString()
}

/**
 * 解析嵌入视频的外部打开信息
 * @param src iframe 原始地址
 * @param baseUrl 当前页面基准地址
 */
export function getEmbeddedVideoInfo(src: string, baseUrl: string): EmbeddedVideoInfo | undefined {
  try {
    const url = new URL(src, baseUrl)
    if (url.protocol !== 'https:') {
      return undefined
    }

    return {
      externalUrl: getExternalVideoUrl(url),
      source: url.hostname.replace(/^www\./i, '')
    }
  } catch {
    return undefined
  }
}
