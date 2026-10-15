import type { CheerioAPI } from 'cheerio/slim'
import { parsePagerTotalPage } from './common'
import { parseTopicIdByLink } from '../links'
import type { V2exNotification } from '../types'

/** 解析提醒列表、总条数与分页，保留摘要和附带内容的 HTML */
export function parseNotifications($: CheerioAPI): {
  totalPage: number
  totalCount: number
  list: V2exNotification[]
} {
  const list: V2exNotification[] = []
  $('#notifications > .cell[id^="n_"]').each((_, element) => {
    const cell = $(element)
    const avatar = cell.find('img.avatar').first()
    const member = cell.find('a[href^="/member/"]').first()
    const summary = cell.find('span.fade').first()
    const topic = summary.find('a.topic-link').first()
    const topicPath = topic.attr('href') || ''
    const id = Number((cell.attr('id') || '').replace(/^n_/, '')) || 0
    if (!id) return
    list.push({
      id,
      avatar: avatar.attr('src') || '',
      username: member.text().trim() || avatar.attr('alt') || '',
      memberPath: member.attr('href') || '',
      summaryHtml: summary.html()?.trim() || '',
      topicId: topicPath ? parseTopicIdByLink(topicPath) : undefined,
      topicTitle: topic.text().trim() || undefined,
      topicPath: topicPath || undefined,
      time: cell.find('span.snow').first().text().trim(),
      payloadHtml: cell.find('.payload').first().html()?.trim() || ''
    })
  })
  return {
    totalPage: parsePagerTotalPage($),
    totalCount: Number($('.header .fr strong.gray').first().text().trim() || 0),
    list
  }
}
