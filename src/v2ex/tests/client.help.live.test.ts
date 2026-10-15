import { describe, expect, test } from 'vitest'
import * as cheerio from 'cheerio/slim'
import { V2exClient } from '../client'

describe('V2exClient help', () => {
  test('loads the official help index and a linked article', async () => {
    const client = new V2exClient()
    try {
      const home = await client.help.getPage()
      expect(home.title).toBe('站点帮助首页')
      expect(home.navigation.some(item => item.slug === 'currency')).toBe(true)
      expect(home.html).toContain('/help/currency')
      const article = await client.help.getPage('currency')
      expect(article.title).toContain('虚拟货币')
      expect(article.html.length).toBeGreaterThan(100)
      expect(article.html).toMatch(/<img[^>]+mod@2x\.png[^>]+width="30"[^>]+height="14"/)
      const node = await client.help.getPage('node')
      expect(node.html.match(/style="height: 24px"/g)).toHaveLength(3)
      expect(article.navigation.length).toBeGreaterThan(1)
    } finally {
      client.dispose()
    }
  })
})

describe('official help directory coverage', () => {
  test('parses every linked help page and preserves its in-page anchors', async () => {
    const client = new V2exClient()
    try {
      const home = await client.help.getPage()
      // 目录动态读取，原站新增主题时自动纳入覆盖
      for (const item of home.navigation) {
        const page = item.slug === 'home' ? home : await client.help.getPage(item.slug)
        expect(page.title, item.slug).not.toBe('')
        expect(
          page.navigation.some(link => link.slug === item.slug),
          item.slug
        ).toBe(true)
        const $ = cheerio.load(page.html)
        $('a[href^="#"]').each((_, element) => {
          const id = $(element).attr('href')!.slice(1)
          expect(
            $('[id]')
              .toArray()
              .some(target => $(target).attr('id') === id),
            `${item.slug}#${id}`
          ).toBe(true)
        })
        if (item.slug === 'api') {
          expect($('.help-code-block').length).toBeGreaterThan(0)
          expect($('.help-page-meta .help-muted')).toHaveLength(2)
          expect($('a[href^="#"]').length).toBeGreaterThan(0)
        }
      }
    } finally {
      client.dispose()
    }
  })
})
