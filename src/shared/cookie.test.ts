import { describe, expect, test } from 'vitest'
import { normalizeLoginCookie } from './cookie'

const a2Value =
  '"2|1:0|10:1773804697|2:A2|56:ZmFrZV92YWx1ZV9mb3JfdGVzdGluZ19vbmx5XzEyMzQ1Njc4OTA=|abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"'
const a2Cookie = `A2=${a2Value}`

describe('normalizeLoginCookie', () => {
  test('picks A2 from full cookie string', () => {
    const cookie = `${a2Cookie}; _ga=GA1.2.1498429214.1779782277; V2EX_LANG=zhcn`

    expect(normalizeLoginCookie(cookie)).toBe(a2Cookie)
  })

  test('normalizes standalone A2 cookie', () => {
    expect(normalizeLoginCookie(`${a2Cookie};`)).toBe(a2Cookie)
  })

  test('normalizes standalone A2 value', () => {
    expect(normalizeLoginCookie(a2Value)).toBe(a2Cookie)
  })

  test('returns empty string when A2 is missing', () => {
    expect(normalizeLoginCookie('V2EX_LANG=zhcn')).toBe('')
  })
})
