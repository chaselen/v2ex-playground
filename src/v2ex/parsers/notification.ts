import type { CheerioAPI } from 'cheerio/slim'
import { findOutsideRichText, parsePagerTotalPage } from './common'
import { parseTopicIdByLink } from '../links'
import type { V2exNotification } from '../types'

/** 解析提醒列表、总条数与分页，保留摘要和附带内容的 HTML */
export function parseNotifications($: CheerioAPI): {
  totalPage: number
  totalCount: number
  list: V2exNotification[]
} {
  const list: V2exNotification[] = []
  const container = $('#notifications').first()
  const box = container.closest('.box').length ? container.closest('.box') : $.root()
  findOutsideRichText(container, '.cell[id^="n_"]')
    .filter((_, element) => !$(element).parents('[id^="n_"]').length)
    .each((_, element) => {
      const cell = $(element)
      const rawId = cell.attr('id') || ''
      if (!/^n_\d+$/.test(rawId)) return
      const id = Number(rawId.slice(2))
      if (!Number.isSafeInteger(id) || id <= 0) return
      const metadata = cell.clone()
      metadata.find('.payload').remove()
      const avatar = metadata.find('img.avatar').first()
      const member = metadata.find('a[href^="/member/"]').first()
      const summary = metadata.find('.gray').first()
      const topic = summary.find('a.topic-link').first()
      const topicPath = topic.attr('href') || ''
      list.push({
        id,
        avatar: avatar.attr('src') || '',
        username: member.text().trim() || avatar.attr('alt') || '',
        memberPath: member.attr('href') || '',
        summaryHtml: summary.html()?.trim() || '',
        topicId: topicPath ? parseTopicIdByLink(topicPath) : undefined,
        topicTitle: topic.text().trim() || undefined,
        topicPath: topicPath || undefined,
        time: metadata.find('.snow').first().text().trim(),
        payloadHtml: cell.find('.payload').first().html()?.trim() || ''
      })
    })
  return {
    totalPage: parsePagerTotalPage($, box),
    totalCount:
      Number(
        findOutsideRichText(box, '.header .fr .gray').first().text().trim().replace(/,/g, '')
      ) || 0,
    list
  }
}
