import * as cheerio from 'cheerio/slim'
import type { HelpPage } from '../types'

/** 从原站帮助路径提取主题，仅接受单一路径段 */
export function getHelpSlug(path: string): string | undefined {
  return path.match(/^\/help\/([a-z0-9-]+)\/?$/)?.[1]
}

/** 解析帮助正文与目录；结构不匹配时显式报错，避免展示登录页或验证页 */
export function parseHelpPage(html: string, slug: string): HelpPage {
  const $ = cheerio.load(html)
  const content = $('#Maincol .markdown_body').first()
  const title = content.find('h1').first().text().trim()
  const navigation: HelpPage['navigation'] = []
  $('#Navcol .nav a').each((_, element) => {
    const item = $(element)
    const slug = getHelpSlug(item.attr('href') || '')
    const title = item.text().trim()
    if (slug && title) navigation.push({ slug, title })
  })
  if (!title || !navigation.length) throw new Error('无法解析原站帮助内容，请稍后重试或查看原文')
  content
    .find('script, style, iframe, object, embed, form, input, button, link, meta, svg')
    .remove()
  content.find('*').each((_, element) => {
    const node = $(element)
    const isCodeBlock =
      element.tagName === 'blockquote' && node.hasClass('f12') && node.children('code').length > 0
    const isMetadata =
      element.tagName === 'div' &&
      node.hasClass('flex-one-row') &&
      node.children('small.fade').length > 0
    const isMuted = element.tagName === 'small' && node.hasClass('fade')
    // 原站节点图标通过行内 px 高度缩放，仅提取尺寸，不保留其他样式
    const imageDimensions =
      element.tagName === 'img'
        ? (node.attr('style') || '').split(';').flatMap(declaration => {
            const match = declaration.trim().match(/^(width|height)\s*:\s*([1-9]\d{0,4})px$/i)
            return match ? [`${match[1].toLowerCase()}: ${match[2]}px`] : []
          })
        : []
    for (const [name, value] of Object.entries(node.attr() || {})) {
      // 帮助文档用显式尺寸显示高分辨率图片，保留尺寸但不接受任意样式
      if ((name === 'width' || name === 'height') && element.tagName === 'img') {
        if (!/^[1-9]\d{0,4}$/.test(value)) node.removeAttr(name)
        continue
      }
      if (name === 'id' && /^[a-zA-Z][\w-]*$/.test(value)) continue
      if (
        name === 'width' &&
        ['td', 'th'].includes(element.tagName) &&
        /^[1-9]\d{0,4}$/.test(value)
      )
        continue
      if (!['href', 'src', 'alt', 'title', 'colspan', 'rowspan'].includes(name)) {
        node.removeAttr(name)
      } else if (name === 'href' || name === 'src') {
        // 页内目录须保留 fragment，由帮助页在当前正文中滚动定位
        if (name === 'href' && /^#[a-zA-Z][\w-]*$/.test(value)) continue
        try {
          const url = new URL(value, 'https://www.v2ex.com/')
          if (!['https:', 'http:'].includes(url.protocol)) node.removeAttr(name)
          else node.attr(name, url.href)
        } catch {
          node.removeAttr(name)
        }
      }
    }
    if (isCodeBlock) node.attr('class', 'help-code-block')
    if (isMetadata) node.attr('class', 'help-page-meta')
    if (isMuted) node.attr('class', 'help-muted')
    if (imageDimensions.length) node.attr('style', imageDimensions.join('; '))
  })
  return { slug, title, navigation, html: content.html() || '' }
}
