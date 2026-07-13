/** 判断当前 Webview 是否运行在 Apple 平台 */
export function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}
