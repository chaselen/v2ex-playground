import { parse as parseCookieHeader, serialize as serializeCookie } from 'cookie'

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

  const parsedCookie = parseCookieHeader(cookie)
  const parsedCookieValue = parsedCookie[loginCookieName]
  if (parsedCookieValue) {
    const loginCookie = serializeCookie(loginCookieName, parsedCookieValue, {
      encode: value => value
    })
    const twoFactorCookieValue = parsedCookie[twoFactorCookieName]
    if (!twoFactorCookieValue) {
      return loginCookie
    }
    const twoFactorCookie = serializeCookie(twoFactorCookieName, twoFactorCookieValue, {
      encode: value => value
    })
    return `${loginCookie}; ${twoFactorCookie}`
  }

  if (rawLoginCookieValuePattern.test(cookie)) {
    return serializeCookie(loginCookieName, cookie.replace(/;$/, ''), { encode: value => value })
  }
  return ''
}
