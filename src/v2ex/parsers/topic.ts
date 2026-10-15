import { parseTopicIdByLink } from '../links'
import * as cheerio from 'cheerio/slim'
import dayjs from '@/core/dayjs'
import { getV2exTimeSpan, type CheerioSelection } from './common'
import type { Node, TagTopicList, Topic, TopicDetail, TopicInfo, TopicReply } from '../types'

/**
 * 解析话题列表项
 * @param $ cheerio 实例
 * @param cells 话题列表元素
 * @param fallbackNode 固定节点信息
 */
export function parseTopicListCells(
  $: cheerio.CheerioAPI,
  cells: CheerioSelection,
  fallbackNode?: Node
): Topic[] {
  const list: Topic[] = []

  cells.each((_, cell) => {
    const topicElement = $(cell).find('a.topic-link')
    const topicHref = topicElement.attr('href')
    const topicId = topicHref ? parseTopicIdByLink(topicHref) : undefined

    if (!topicId) {
      return
    }

    const nodeElement = $(cell).find('a.node')
    const nodeHref = nodeElement.attr('href') || ''
    // 在/my/topics页面中，自己的帖子回复数元素名为.count_orange
    const countElement = $(cell).find('.count_livid, .count_orange')
    const topicInfo = $(cell).find('.topic_info')
    const publishedTime = getV2exTimeSpan(topicInfo)
    const hasLastReply = /Lastly replied by|最后回复/.test(topicInfo.text())
    const memberLinks = topicInfo.find('strong a[href^="/member/"]')
    const publishedAt = publishedTime.attr('title')

    list.push({
      id: topicId,
      title: topicElement.text().trim(),
      node: fallbackNode
        ? { ...fallbackNode }
        : {
            name: nodeHref.split('go/')[1] || '',
            title: nodeElement.text().trim()
          },
      authorName: memberLinks.first().text().trim(),
      replies: Number(countElement.text().trim()) || 0,
      displayTime: publishedTime.text().trim(),
      publishedAt: publishedAt ? dayjs(publishedAt).format('YYYY-MM-DD HH:mm:ss') : undefined,
      lastReplyUser: hasLastReply ? memberLinks.last().text().trim() : ''
    })
  })

  return list
}

/**
 * 解析标签主题列表
 * @param $ cheerio 实例
 * @param tag 标签名称
 */
export function parseTagTopicList($: cheerio.CheerioAPI, tag: string): TagTopicList {
  const list = parseTopicListCells($, $('#Main > .box').eq(0).children('.cell.item'))

  return {
    tag,
    totalCount: list.length,
    list
  }
}

/**
 * 解析话题元信息
 * @param $ cheerio 实例
 * @param topicId 话题id
 * @param baseUrl V2EX 基础地址
 */
export function parseTopicMeta(
  $: cheerio.CheerioAPI,
  topicId: number,
  baseUrl: string
): TopicDetail {
  const topic: TopicDetail = {
    id: topicId,
    title: $('.header > h1').text(),
    node: {
      name: '',
      title: ''
    },
    tags: [],
    authorAvatar: '',
    topicIcon: '',
    authorName: '',
    isAuthorPro: false,
    displayTime: '',
    publishedAt: '',
    visitCount: 0,
    content: '',
    appends: [],
    collectCount: 0,
    thankCount: 0,
    isCollected: false,
    isIgnored: false,
    canIgnore: false,
    isThanked: false,
    canThank: true,
    collectParamT: null,
    replyCount: 0,
    replyCurrentPage: 1,
    replyTotalPage: 1,
    replies: []
  }
  const node = $('.header a[href^=/go/]')
  topic.node.name = node.attr('href')?.split('go/')[1] || ''
  topic.node.title = node.text().trim()
  topic.tags = getTopicReplyBox($)
    .children('.cell')
    .first()
    .find('a.tag[href^="/tag/"]')
    .map((_, element) => $(element).text().trim())
    .get()
  const topicIcon = $('head link[rel~="icon"]').first().attr('href')
  topic.topicIcon = topicIcon ? new URL(topicIcon, baseUrl).toString() : ''
  topic.authorAvatar = $('.header > .fr img.avatar').attr('src') || ''
  const headerMeta = $('.header > .gray')
  const meta = headerMeta.text().split('·')
  topic.authorName = headerMeta.find('a[href^=/member]').text().trim()
  topic.isAuthorPro = headerMeta.find('.badges .badge.pro').length > 0
  const publishedTime = getV2exTimeSpan(headerMeta, { direct: true })
  topic.displayTime = publishedTime.text().trim()
  topic.publishedAt = dayjs(publishedTime.attr('title')!).format('YYYY-MM-DD HH:mm:ss')
  topic.visitCount = Number(
    meta.find(item => /(?:views|次点击)/i.test(item))?.match(/\d+/)?.[0] || 0
  )
  topic.content = $('#Main .topic_content').html() || ''
  $('.subtle').each((_, element) => {
    topic.appends.push({
      time: $(element).children('.fade').text().split('·')[1].trim(),
      content: $(element).children('.topic_content').html() || ''
    })
  })

  topic.canViewInfo = headerMeta.find(`a[href="/t/${topicId}/info"]`).length > 0

  topic.managementActions = (['edit', 'move', 'append'] as const).filter(
    action => headerMeta.find(`a[href="/${action}/topic/${topicId}"]`).length > 0
  )

  const topicButtons = $('.topic_buttons')
  if (topicButtons.length) {
    const countStr = topicButtons.children('.topic_stats').text()
    if (/(\d+)\s*人收藏/.test(countStr)) {
      topic.collectCount = parseInt(RegExp.$1)
    }
    if (/(\d+)\s*人感谢/.test(countStr)) {
      topic.thankCount = parseInt(RegExp.$1)
    }
    const collectButton = topicButtons.children('a.tb').eq(0)
    topic.isCollected = collectButton.text().indexOf('取消收藏') >= 0
    topic.collectParamT = collectButton.attr('href')?.split('?t=')[1] || null
    const ignoreButton = topicButtons
      .children('a.tb')
      .filter((_, element) => /^(忽略主题|取消忽略)$/.test($(element).text().trim()))
      .first()
    topic.isIgnored = ignoreButton.text().trim() === '取消忽略'
    topic.canIgnore = ignoreButton.length > 0
    topic.canThank = topicButtons.children('#topic_thank').length > 0
    topic.isThanked = topicButtons.find('.topic_thanked').length > 0
  }

  const topicBox = getTopicReplyBox($)
  topic.replyCount = parseReplyCount(topicBox)
  return topic
}

/**
 * 获取回复列表
 * @param $ cheerio 实例
 */
export function parseReplies($: cheerio.CheerioAPI): TopicReply[] {
  const replies: TopicReply[] = []
  const topicBox = getTopicReplyBox($)
  topicBox.children('div[id].cell').each((_, element) => {
    const replyTime = getV2exTimeSpan($(element))
    const badges = $(element).find('.badges').first()

    replies.push({
      replyId: $(element).attr('id')?.split('r_')[1] || '0',
      userAvatar: $(element).find('img.avatar').attr('src') || '',
      userName: $(element).find('a.dark').html() || '',
      isMod: badges.find('.badge.mod').length > 0,
      isOp: badges.find('.badge.op').length > 0,
      isPro: badges.find('.badge.pro').length > 0,
      time: replyTime.text().trim(),
      repliedAt: dayjs(replyTime.attr('title')!).format('YYYY-MM-DD HH:mm:ss'),
      floor: $(element).find('span.no').text(),
      content: $(element).find('.reply_content').html() || '',
      thanks: parseInt($(element).find('span.small.fade').text().trim() || '0'),
      thanked: $(element).find('.thank_area.thanked').length > 0
    })
  })
  return replies
}

/**
 * 解析回复总数
 * @param topicBox 回复列表外层容器
 */
function parseReplyCount(topicBox: CheerioSelection): number {
  const headerText = topicBox.children('div.cell').first().find('span.gray').first().text()
  return Number(headerText.match(/(\d+)\s*条回复/)?.[1] || 0)
}

/**
 * 获取话题回复列表容器
 * @param $ cheerio 实例
 */
function getTopicReplyBox($: cheerio.CheerioAPI): CheerioSelection {
  let topicBoxIndex = 1
  const boxes = $('#Main > .box')
  if (boxes.eq(1).attr('id') === 'topic-tip-box') {
    topicBoxIndex = 2
  }
  return boxes.eq(topicBoxIndex)
}

/** 仅接受信息页表格，登录页、无权限页与重定向后的详情页不能视为成功 */
export function parseTopicInfo(html: string, topicId: number): TopicInfo {
  const $ = cheerio.load(html)
  const fields: TopicInfo['fields'] = []
  $('#Main .topic_content table tr').each((_, row) => {
    const cells = $(row).children('td')
    if (cells.length !== 2) return
    const label = cells.eq(0).text().trim()
    const value = cells.eq(1).text().trim()
    if (label) fields.push({ label, value })
  })
  if (!fields.some(field => field.label === 'ID' && field.value === String(topicId))) {
    throw new Error('无法读取帖子信息，请确认登录状态和访问权限后重试')
  }
  return { fields }
}
