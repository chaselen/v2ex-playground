import { describe, expect, test } from 'vitest'
import { normalizeLoginCookie } from './cookie'

const a2Value =
  '"2|1:0|10:1773804697|2:A2|56:ZmFrZV92YWx1ZV9mb3JfdGVzdGluZ19vbmx5XzEyMzQ1Njc4OTA=|abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"'
const a2Cookie = `A2=${a2Value}`
const a2oValue =
  '"2|1:0|10:1782088690|3:A2O|56:ZmFrZV9hMm9fdmFsdWVfZm9yX3Rlc3Rpbmdfb25seV8xMjM0NTY3ODkw|fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"'
const a2oCookie = `A2O=${a2oValue}`

describe('normalizeLoginCookie', () => {
  test('picks A2 from full cookie string', () => {
    const cookie = `${a2Cookie}; _ga=GA1.2.1498429214.1779782277; V2EX_LANG=zhcn`

    expect(normalizeLoginCookie(cookie)).toBe(a2Cookie)
  })

  test('keeps A2O from full cookie string', () => {
    const cookie = `${a2Cookie}; ${a2oCookie}; V2EX_LANG=zhcn`

    expect(normalizeLoginCookie(cookie)).toBe(`${a2Cookie}; ${a2oCookie}`)
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
