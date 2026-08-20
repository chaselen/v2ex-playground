import { parseCookie, stringifyCookie } from 'cookie'

/** 登录态 Cookie 名称 */
export const loginCookieName = 'A2'

/** 两步验证 Cookie 名称 */
export const twoFactorCookieName = 'A2O'

/** 裸 A2 值格式 */
const rawLoginCookieValuePattern = /^"[^"]+";?$/

/**
 * 归一化登录态 Cookie
 * @param input 用户输入或 Cookie 字符串
 */
export function normalizeLoginCookie(input: string | undefined): string {
  // 容错处理：如果用户把前面的键也复制进去了，则手动去掉前面的cookie:
  const cookie = input?.trim().replace(/^cookie:\s*/i, '') || ''
  if (!cookie) {
    return ''
  }

  const parsedCookieValue = getLastCookieValue(cookie, loginCookieName)
  if (parsedCookieValue) {
    const loginCookie = stringifyCookie(
      { [loginCookieName]: parsedCookieValue },
      { encode: value => value }
    )
    const twoFactorCookieValue = getLastCookieValue(cookie, twoFactorCookieName)
    if (!twoFactorCookieValue) return loginCookie
    const twoFactorCookie = stringifyCookie(
      { [twoFactorCookieName]: twoFactorCookieValue },
      { encode: value => value }
    )
    return `${loginCookie}; ${twoFactorCookie}`
  }

  if (rawLoginCookieValuePattern.test(cookie)) {
    return stringifyCookie(
      { [loginCookieName]: cookie.replace(/;$/, '') },
      { encode: value => value }
    )
  }
  return ''
}

/**
 * 从 Cookie 头中获取指定名称的最后一个值
 *
 * 服务器更新认证 Cookie 时，旧路径或域名范围的同名 Cookie 可能仍保留在 CookieJar 中。
 * Cookie 请求头会按创建顺序排列，最后一个值是最新写入的认证状态。
 */
function getLastCookieValue(cookie: string, name: string): string | undefined {
  let value: string | undefined
  for (const item of cookie.split(';')) {
    const parsed = parseCookie(item.trim(), { decode: value => value })
    if (parsed[name]) value = parsed[name]
  }
  return value
}
