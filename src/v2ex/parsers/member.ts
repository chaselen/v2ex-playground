import { parseTopicIdByLink } from '../links'
import * as cheerio from 'cheerio/slim'
import { findOutsideRichText, parsePagerTotalPage, type CheerioSelection } from './common'
import { parseTopicListCells } from './topic'
import type { MemberContent, MemberContentTabKey, MemberInfo, MemberReply } from '../types'

/**
 * 解析用户基本信息
 * @param $ cheerio 实例
 * @param fallbackUsername 兜底用户名
 */
export function parseMemberInfo($: cheerio.CheerioAPI, fallbackUsername: string): MemberInfo {
  const profileBox = findMemberProfileBox($)
  const avatar = findOutsideRichText(profileBox, 'img.avatar').first()
  const grayText = findOutsideRichText(profileBox, '.gray')
    .filter((_, element) => {
      const text = $(element).text()
      return text.includes('member #') || text.includes('号会员')
    })
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
  const ldJson = parseMemberLdJson($)
  /** 用户数字编号 */
  const memberId =
    Number(avatar.attr('data-uid')) ||
    Number(grayText.match(/(?:member #|第\s*)(\d+)(?:\s*号会员)?/i)?.[1] || 0) ||
    Number(ldJson?.identifier || 0)
  const joinedAt =
    grayText.match(/(?:joined on|加入于)\s*([\d-]+\s+[\d:]+\s+[+-][\d:]+)/i)?.[1]?.trim() ||
    String(ldJson?.dateCreated || '')
  const activityRank =
    Number(grayText.match(/(?:activity rank|活跃度排名)\s*(\d+)/i)?.[1] || 0) || undefined
  /** 当前用户特别关注状态 */
  const isFollowing = parseMemberActionState($, profileBox, 'follow')
  /** 当前用户屏蔽状态 */
  const isBlocked = parseMemberActionState($, profileBox, 'block')

  const member: MemberInfo = {
    avatar: avatar.attr('src') || String(ldJson?.image || ''),
    username:
      findOutsideRichText(profileBox, 'h1').first().text().trim() ||
      avatar.attr('alt') ||
      String(ldJson?.name || '') ||
      fallbackUsername,
    tagline:
      findOutsideRichText(profileBox, '.bigger').first().text().trim() ||
      String(ldJson?.description || ''),
    bio: '',
    memberId,
    joinedAt,
    isPro: findOutsideRichText(profileBox, '.badges .badge.pro').length > 0,
    activityRank
  }

  if (isFollowing !== undefined) {
    member.isFollowing = isFollowing
  }
  if (isBlocked !== undefined) {
    member.isBlocked = isBlocked
  }

  return member
}

/**
 * 解析用户关系操作状态
 * @param $ cheerio 实例
 * @param profileBox 用户资料容器
 * @param action 关系操作
 */
function parseMemberActionState(
  $: cheerio.CheerioAPI,
  profileBox: CheerioSelection,
  action: 'follow' | 'block'
): boolean | undefined {
  const actionPattern = new RegExp(`/(un)?${action}/\\d+\\?once=`)
  const actionElement = findOutsideRichText(profileBox, '[onclick]')
    .filter((_, element) => actionPattern.test(String($(element).attr('onclick') || '')))
    .first()
  if (!actionElement.length) {
    return undefined
  }

  const actionMatch = actionPattern.exec(String(actionElement.attr('onclick') || ''))
  return Boolean(actionMatch?.[1])
}

/**
 * 解析用户页内容
 * @param $ cheerio 实例
 * @param tab 标签
 * @param page 页码
 */
export function parseMemberContent(
  $: cheerio.CheerioAPI,
  tab: MemberContentTabKey,
  page: number
): MemberContent {
  const content: MemberContent = {
    tab,
    page,
    totalPage: parsePagerTotalPage($, $('#Main')),
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
  content.message = parseMemberTopicMessage($, topicBox)
  content.hidden = Boolean(content.message)

  if (!content.hidden) {
    content.topics = parseTopicListCells($, findOutsideRichText(topicBox, '.cell.item'))
  }

  return content
}

/**
 * 查找用户基本信息容器
 * @param $ cheerio 实例
 */
function findMemberProfileBox($: cheerio.CheerioAPI): CheerioSelection {
  const main = $('#Main')
  const title = findOutsideRichText(main, 'h1').first()
  if (title.length) return title.closest('.box')
  return findOutsideRichText(main, 'img.avatar[data-uid]').first().closest('.box')
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
    const parsed = JSON.parse(rawJson) as {
      dateCreated?: unknown
      mainEntity?: Record<string, unknown>
    }
    return parsed.mainEntity ? { dateCreated: parsed.dateCreated, ...parsed.mainEntity } : undefined
  } catch {
    return undefined
  }
}

/**
 * 查找用户页主题列表容器
 * @param $ cheerio 实例
 */
function findMemberTopicBox($: cheerio.CheerioAPI): CheerioSelection {
  const main = $('#Main')
  const tabs = findOutsideRichText(main, '.cell_tabs').first()
  if (tabs.length) return tabs.closest('.box')
  const item = findOutsideRichText(main, '.cell.item').first()
  if (item.length) return item.closest('.box')
  return findOutsideRichText(main, '.header').first().closest('.box')
}

/**
 * 解析用户主题列表提示
 * @param topicBox 主题列表容器
 */
function parseMemberTopicMessage($: cheerio.CheerioAPI, topicBox: CheerioSelection): string {
  const hiddenText = topicBox
    .find('.topic_content')
    .not('.reply_content *, .topic_content .topic_content')
    .filter((_, element) => /topics list is hidden|主题列表被隐藏/.test($(element).text()))
    .first()
    .text()
    .trim()
  return hiddenText || ''
}

/**
 * 解析用户内容总数
 * @param $ cheerio 实例
 */
function parseMemberContentTotalCount($: cheerio.CheerioAPI): number {
  const text = findOutsideRichText($('#Main'), '.header .fr .gray').first().text().trim()
  return Number(text.replace(/,/g, '')) || 0
}

/**
 * 解析用户回复列表
 * @param $ cheerio 实例
 */
function parseMemberReplies($: cheerio.CheerioAPI): MemberReply[] {
  const replies: MemberReply[] = []

  findOutsideRichText($('#Main'), '.dock_area').each((_, element) => {
    const dock = $(element)
    let contentHtml = ''
    // 允许分隔元素和正文包装，但不能跨过下一条回复摘要借用其正文
    for (let sibling = dock.next(); sibling.length; sibling = sibling.next()) {
      if (sibling.is('.dock_area') || findOutsideRichText(sibling, '.dock_area').length) break
      const body = sibling.is('.reply_content') ? sibling : sibling.find('.reply_content').first()
      if (body.length) {
        contentHtml = body.html()?.trim() || ''
        break
      }
    }
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
      contentHtml
    })
  })

  return replies.filter(reply => reply.topicTitle || reply.contentHtml)
}
