import { describe, expect, test } from 'vitest'
import {
  getHelpSlug,
  getTopicLink,
  getMemberLink,
  getNodeLink,
  getTagLink,
  parseTopicIdByLink,
  isV2exUrl,
  isV2exPath,
  isGenericV2exIcon
} from '../index'

describe('public help link helper', () => {
  test.each(['currency', 'new-topic', 'home'])('接受单个帮助主题路径：%s', slug => {
    expect(getHelpSlug(`/help/${slug}`)).toBe(slug)
    expect(getHelpSlug(`/help/${slug}/`)).toBe(slug)
  })

  test.each(['/help/../../settings', '/help/a/b', '/help/', '/settings', '/help/Currency'])(
    '拒绝不属于帮助主题的路径：%s',
    path => {
      expect(getHelpSlug(path)).toBeUndefined()
    }
  )
})

describe('site icons', () => {
  test('区分站点默认图标和节点图标', () => {
    expect(isGenericV2exIcon('/static/favicon.ico')).toBe(true)
    expect(isGenericV2exIcon('https://www.v2ex.com/static/icon-192.png')).toBe(true)
    expect(isGenericV2exIcon('https://www.v2ex.com/static/apple-touch-icon-180.png?v=1')).toBe(true)
    expect(isGenericV2exIcon('https://cdn.v2ex.com/navatar/94f6/d7e0/300_xxlarge.png')).toBe(false)
    expect(isGenericV2exIcon('https://example.com/static/favicon.ico')).toBe(false)
  })
})

describe('public resource links', () => {
  test('生成主题、用户、节点链接并提取主题编号', () => {
    expect(getTopicLink(703733)).toBe('https://www.v2ex.com/t/703733')
    expect(getTopicLink('1136705')).toBe('https://www.v2ex.com/t/1136705')
    expect(getMemberLink('Livid')).toBe('https://www.v2ex.com/member/Livid')
    for (const node of ['programmer', 'vibe-coding', '0x10c']) {
      expect(getNodeLink(node)).toBe(`https://www.v2ex.com/go/${node}`)
    }
    expect(parseTopicIdByLink('/t/1136705#reply50')).toBe(1136705)
    expect(parseTopicIdByLink('https://www.v2ex.com/t/703733?p=2#reply12')).toBe(703733)
    expect(parseTopicIdByLink('/go/v2ex')).toBeUndefined()
  })

  test('标签去除首尾空白并编码特殊字符', () => {
    expect(getTagLink(' VS Code ')).toBe('https://www.v2ex.com/tag/VS%20Code')
    expect(getTagLink('中文/#')).toBe('https://www.v2ex.com/tag/%E4%B8%AD%E6%96%87%2F%23')
    expect(() => getTagLink('  ')).toThrow('标签名称不能为空')
  })

  test('链接生成可指定站点基础地址', () => {
    const baseUrl = 'https://edge.v2ex.com'
    expect(getTopicLink(1, baseUrl)).toBe(`${baseUrl}/t/1`)
    expect(getMemberLink('Livid', baseUrl)).toBe(`${baseUrl}/member/Livid`)
    expect(getNodeLink('sandbox', baseUrl)).toBe(`${baseUrl}/go/sandbox`)
    expect(getTagLink('VS Code', baseUrl)).toBe(`${baseUrl}/tag/VS%20Code`)
  })
})

describe('V2EX URL boundaries', () => {
  test.each([
    'https://v2ex.com',
    'https://www.v2ex.com/t/1',
    'https://edge.v2ex.com/2fa',
    'http://v2ex.com',
    'http://www.v2ex.com/t/1',
    'http://edge.v2ex.com/2fa'
  ])('接受 HTTP、HTTPS 原站及子域名：%s', value => {
    expect(isV2exUrl(new URL(value))).toBe(true)
  })

  test.each([
    'ftp://www.v2ex.com',
    'ws://www.v2ex.com',
    'https://v2ex.com.evil.test',
    'https://evilv2ex.com',
    'https://www.sov2ex.com',
    'https://www.v2ex.com:8443'
  ])('拒绝其他协议、相似域名和非默认端口：%s', value => {
    expect(isV2exUrl(new URL(value))).toBe(false)
  })

  test('路径判断同时校验站点并精确匹配 pathname', () => {
    expect(isV2exPath(new URL('https://www.v2ex.com/2fa?next=/'), '/2fa')).toBe(true)
    expect(isV2exPath(new URL('http://www.v2ex.com/2fa?next=/'), '/2fa')).toBe(true)
    expect(isV2exPath(new URL('http://www.v2ex.com/2fa/'), '/2fa')).toBe(false)
    expect(isV2exPath(new URL('https://www.v2ex.com/2fa/'), '/2fa')).toBe(false)
    expect(isV2exPath(new URL('https://example.com/2fa'), '/2fa')).toBe(false)
  })
})
