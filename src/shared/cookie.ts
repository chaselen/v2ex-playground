import { parse as parseCookieHeader, serialize as serializeCookie } from 'cookie'

/** 登录态 Cookie 名称 */
export const loginCookieName = 'A2'

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

  const parsedCookieValue = parseCookieHeader(cookie)[loginCookieName]
  if (parsedCookieValue) {
    return serializeLoginCookie(parsedCookieValue)
  }

  if (rawLoginCookieValuePattern.test(cookie)) {
    return serializeLoginCookie(cookie.replace(/;$/, ''))
  }
  return ''
}

/**
 * 序列化登录态 Cookie
 * @param value A2 Cookie 值
 */
function serializeLoginCookie(value: string): string {
  return serializeCookie(loginCookieName, value, { encode: value => value })
}
