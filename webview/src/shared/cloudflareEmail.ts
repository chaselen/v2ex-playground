/** href 直接携带编码邮箱时使用的 Cloudflare 链接前缀 */
const CLOUDFLARE_EMAIL_PROTECTION_HASH = '/cdn-cgi/l/email-protection#'

/** 通过 data-cfemail 携带编码邮箱的 Cloudflare 元素选择器 */
const CLOUDFLARE_EMAIL_SELECTOR = '.__cf_email__[data-cfemail]'

/**
 * 解码 Cloudflare Email Address Obfuscation 数据
 * @param encoded 十六进制编码文本，首字节为 XOR 密钥
 * @example
 * decodeCloudflareEmail('8ef6cea0e1fce9') // 'x@.org'
 */
export function decodeCloudflareEmail(encoded: string): string | undefined {
  if (encoded.length < 4 || encoded.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(encoded)) {
    return undefined
  }

  const key = Number.parseInt(encoded.slice(0, 2), 16)
  const bytes = new Uint8Array((encoded.length - 2) / 2)

  for (let index = 2; index < encoded.length; index += 2) {
    bytes[index / 2 - 1] = Number.parseInt(encoded.slice(index, index + 2), 16) ^ key
  }

  return new TextDecoder().decode(bytes)
}

/**
 * 解码 HTML 内容中的 Cloudflare 邮箱保护元素
 *
 * 支持 href hash 携带编码邮箱，以及 data-cfemail 携带可见邮箱文本两种结构
 *
 * @example
 * // href hash 形式
 * // 转换前
 * <a href="/cdn-cgi/l/email-protection#8ef6cea0e1fce9">联系我</a>
 * // 转换后
 * <a href="mailto:x@.org">联系我</a>
 *
 * // data-cfemail 形式
 * // 转换前
 * <a href="/cdn-cgi/l/email-protection"
 *    class="__cf_email__"
 *    data-cfemail="8ef6cea0e1fce9">[email protected]</a>
 * // 转换后
 * x@.org
 *
 * @param root HTML 内容根节点
 */
export function decodeCloudflareEmails(root: ParentNode) {
  // href 中直接携带编码邮箱时，恢复为可点击的 mailto 链接
  root
    .querySelectorAll<HTMLAnchorElement>(`a[href*="${CLOUDFLARE_EMAIL_PROTECTION_HASH}"]`)
    .forEach(anchor => {
      const href = anchor.getAttribute('href') || ''
      const hashIndex = href.indexOf(CLOUDFLARE_EMAIL_PROTECTION_HASH)
      const email = decodeCloudflareEmail(
        href.slice(hashIndex + CLOUDFLARE_EMAIL_PROTECTION_HASH.length)
      )
      if (email) {
        anchor.href = `mailto:${email}`
      }
    })

  // data-cfemail 用于替换页面中的邮箱占位文本
  root.querySelectorAll<HTMLElement>(CLOUDFLARE_EMAIL_SELECTOR).forEach(element => {
    const email = decodeCloudflareEmail(element.dataset.cfemail || '')
    if (email) {
      element.replaceWith(document.createTextNode(email))
    }
  })
}
