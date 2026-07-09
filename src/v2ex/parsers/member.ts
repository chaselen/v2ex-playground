import * as cheerio from 'cheerio/slim'
import { parsePagerTotalPage, type CheerioSelection } from './common'
import { parseTopicIdByLink, parseTopicListCells } from './topic'
import type { MemberContent, MemberContentTabKey, MemberInfo, MemberReply } from '../types'

/**
 * 解析用户基本信息
 * @param $ cheerio 实例
 * @param fallbackUsername 兜底用户名
 */
export function parseMemberInfo($: cheerio.CheerioAPI, fallbackUsername: string): MemberInfo {
  const profileBox = findMemberProfileBox($)
  const avatar = profileBox.find('img.avatar[data-uid]').first()
  const grayText = profileBox
    .find('span.gray')
    .filter((_, element) => {
      const text = $(element).text()
      return text.includes('member #') || text.includes('号会员')
    })
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
  const ldJson = parseMemberLdJson($)
  const memberNumber =
    Number(avatar.attr('data-uid')) ||
    Number(grayText.match(/member #(\d+)/i)?.[1] || 0) ||
    Number(ldJson?.identifier || 0)
  const joinedAt =
    grayText.match(/(?:joined on|加入于)\s*([\d-]+\s+[\d:]+\s+[+-][\d:]+)/i)?.[1]?.trim() ||
    String(ldJson?.dateCreated || '')
  const activityRank =
    Number(grayText.match(/(?:activity rank|活跃度排名)\s*(\d+)/i)?.[1] || 0) || undefined

  return {
    avatar: avatar.attr('src') || String(ldJson?.image || ''),
    username:
      profileBox.find('h1').first().text().trim() ||
      avatar.attr('alt') ||
      String(ldJson?.name || '') ||
      fallbackUsername,
    memberNumber,
    joinedAt,
    isPro: profileBox.find('.badges .badge.pro').length > 0,
    activityRank
  }
}

/**
 * 解析用户页内容
 * @param $ cheerio 实例
 * @param username 用户名
 * @param tab 标签
 * @param page 页码
 */
export function parseMemberContent(
  $: cheerio.CheerioAPI,
  username: string,
  tab: MemberContentTabKey,
  page: number
): MemberContent {
  const content: MemberContent = {
    tab,
    page,
    totalPage: parsePagerTotalPage($),
    totalCount: parseMemberContentTotalCount($),
    topics: [],
    replies: [],
    hidden: false,
    message: ''
  }

  if (tab === 'replies') {
    content.replies = parseMemberReplies($)
    return content
  }

  const topicBox = findMemberTopicBox($)
  content.hidden =
    topicBox.text().includes('topics list is hidden') ||
    topicBox.text().includes('主题列表被隐藏') ||
    $('#Main').text().includes('topics list is hidden') ||
    $('#Main').text().includes('主题列表被隐藏')
  content.message = parseMemberTopicMessage($, topicBox, username)

  if (!content.hidden) {
    content.topics = parseTopicListCells($, topicBox.children('.cell.item'))
  }

  return content
}

/**
 * 查找用户基本信息容器
 * @param $ cheerio 实例
 */
function findMemberProfileBox($: cheerio.CheerioAPI): CheerioSelection {
  const boxes = $('#Main > .box')
  const profileBox = boxes
    .filter((_, element) => $(element).find('img.avatar[data-uid]').length > 0)
    .first()

  return profileBox
}

/**
 * 解析用户页结构化数据
 * @param $ cheerio 实例
 */
function parseMemberLdJson($: cheerio.CheerioAPI): Record<string, unknown> | undefined {
  const rawJson = $('script[type="application/ld+json"]').first().text().trim()
  if (!rawJson) {
    return undefined
  }

  try {
    const parsed = JSON.parse(rawJson) as { mainEntity?: Record<string, unknown> }
    return parsed.mainEntity
  } catch {
    return undefined
  }
}

/**
 * 查找用户页主题列表容器
 * @param $ cheerio 实例
 */
function findMemberTopicBox($: cheerio.CheerioAPI): CheerioSelection {
  const boxes = $('#Main > .box')
  const tabBox = boxes.filter((_, element) => $(element).children('.cell_tabs').length > 0).first()
  if (tabBox.length) {
    return tabBox
  }

  return boxes.filter((_, element) => $(element).children('.cell.item').length > 0).first()
}

/**
 * 解析用户主题列表提示
 * @param topicBox 主题列表容器
 * @param username 用户名
 */
function parseMemberTopicMessage(
  $: cheerio.CheerioAPI,
  topicBox: CheerioSelection,
  username: string
): string {
  const hiddenText =
    topicBox.find('.topic_content .gray').first().text().trim() ||
    $('#Main .topic_content .gray')
      .filter(
        (_, element) =>
          $(element).text().includes('topics list is hidden') ||
          $(element).text().includes('主题列表被隐藏')
      )
      .first()
      .text()
      .trim()
  if (hiddenText) {
    return hiddenText
  }

  if (
    topicBox.text().includes('topics list is hidden') ||
    topicBox.text().includes('主题列表被隐藏')
  ) {
    return `${username} 已隐藏主题列表`
  }

  return ''
}

/**
 * 解析用户内容总数
 * @param $ cheerio 实例
 */
function parseMemberContentTotalCount($: cheerio.CheerioAPI): number {
  const text = $('#Main > .box .header .fr strong.gray').first().text().trim()
  return Number(text.replace(/,/g, '')) || 0
}

/**
 * 解析用户回复列表
 * @param $ cheerio 实例
 */
function parseMemberReplies($: cheerio.CheerioAPI): MemberReply[] {
  const replies: MemberReply[] = []

  $('#Main > .box .dock_area').each((_, element) => {
    const dock = $(element)
    const body = dock.next('.inner, .cell')
    const summary = dock.find('.gray').first()
    const topic = summary.find('a[href*="/t/"]').last()
    const topicPath = topic.attr('href') || ''
    const node = summary.find('a[href^="/go/"]').last()
    const topicAuthor = summary.find('a[href^="/member/"]').first()

    replies.push({
      topicId: topicPath ? parseTopicIdByLink(topicPath) : undefined,
      topicTitle: topic.text().trim(),
      topicPath,
      node: {
        name: (node.attr('href') || '').split('/go/')[1] || '',
        title: node.text().trim()
      },
      topicAuthor: topicAuthor.text().trim(),
      time: dock.find('.fade').first().attr('title') || dock.find('.fade').first().text().trim(),
      summaryHtml: summary.html()?.trim() || '',
      contentHtml: body.find('.reply_content').first().html()?.trim() || ''
    })
  })

  return replies.filter(reply => reply.topicTitle || reply.contentHtml)
}
