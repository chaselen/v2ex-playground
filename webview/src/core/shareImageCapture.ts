/** 分享图光栅输出的安全高度上限 */
const MAX_SHARE_IMAGE_RASTER_HEIGHT = 30000

/** 分享图最高像素倍率 */
const MAX_SHARE_IMAGE_PIXEL_RATIO = 2

/**
 * 计算分享图像素倍率
 * @param contentHeight 卡片 CSS 像素高度
 */
export function calculateShareImagePixelRatio(contentHeight: number) {
  return Math.min(
    MAX_SHARE_IMAGE_PIXEL_RATIO,
    MAX_SHARE_IMAGE_RASTER_HEIGHT / Math.max(contentHeight, 1)
  )
}

/**
 * 判断展示地址是否仍是原始远程图片
 * @param originalSrc HTML 中的原始图片地址
 * @param displaySrc 当前准备读取的展示地址
 * @param baseUrl Webview 文档基准地址
 */
export function isOriginalRemoteShareImage(
  originalSrc: string,
  displaySrc: string,
  baseUrl: string
) {
  try {
    const originalUrl = new URL(originalSrc, baseUrl)
    const displayUrl = new URL(displaySrc, baseUrl)
    return isHttpUrl(originalUrl) && isHttpUrl(displayUrl) && originalUrl.href === displayUrl.href
  } catch {
    return false
  }
}

/** 判断 URL 是否使用 HTTP(S) 协议 */
function isHttpUrl(url: URL) {
  return url.protocol === 'http:' || url.protocol === 'https:'
}
