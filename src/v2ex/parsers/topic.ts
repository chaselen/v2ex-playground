// 完整 cheerio 入口会额外打包 parse5、undici 和编码处理依赖，显著增大 VSIX
// 复用 slim 的 htmlparser2，并由 decodeTextarea 补齐 textarea 的文本恢复规则
import { parseTopicIdByLink } from '../links'
import * as cheerio from 'cheerio/slim'
import { decodeHTML } from 'entities'
import dayjs from '@/core/dayjs'
import { getV2exTimeSpan, type CheerioSelection } from './common'
import type {
  Node,
  TagTopicList,
  Topic,
  TopicDetail,
  TopicInfo,
  TopicReply,
  TopicContentAction,
  TopicContentState,
  TopicManagementAction,
  TopicManagementState
} from '../types'

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
    const topicElement = $(cell).find('a.topic-link').first()
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
    const authorAvatar = $(cell).find('a[href^="/member/"] img.avatar').first()
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
      authorName: authorAvatar.attr('alt')?.trim() || memberLinks.first().text().trim(),
      authorAvatar: authorAvatar.attr('src'),
      replies: Number(countElement.text().trim()) || 0,
      displayTime: publishedTime.text().trim(),
      publishedAt: publishedAt ? formatTopicTime(publishedAt) : undefined,
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
 * 选择主题图标
 *
 * 打开「节点图标作为 favicon」时优先选择节点 navatar，避免误取站点默认图标。
 * 关闭后只剩 `/static/favicon.ico`、`icon-192.png` 等站点图标。
 * @param $ cheerio 实例
 */
function selectTopicIcon($: cheerio.CheerioAPI): string {
  const icons = $('head link[rel~="icon"]')
    .map((_, element) => $(element).attr('href')?.trim() || '')
    .get()
    .filter(icon => icon.length > 0)

  return icons.find(icon => icon.includes('/navatar/')) || icons[0] || ''
}

/** 只读取主题结构，排除正文、附言正文与回复中出现的同名元素 */
function findTopicElements(scope: CheerioSelection, selector: string): CheerioSelection {
  return scope.find(selector).not('.topic_content *, .reply_content *, #topic-replies *')
}

/** 通过主题标题定位头部，避免依赖主内容区盒子的排列顺序 */
function getTopicHeader($: cheerio.CheerioAPI): CheerioSelection {
  const scope = $('#Main').length ? $('#Main') : $.root()
  const headers = findTopicElements(scope, '.header')
  const topicHeader = headers.filter((_, element) => $(element).find('h1').length > 0).first()
  return topicHeader.length ? topicHeader : headers.first()
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
  const header = getTopicHeader($)
  const box = header.closest('.box').length ? header.closest('.box') : $('#Main > .box').first()
  const topic: TopicDetail = {
    id: topicId,
    title: header.find('h1').first().text(),
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
  const node = header.find('a[href^="/go/"]').first()
  topic.node.name = node.attr('href')?.split('go/')[1] || ''
  topic.node.title = node.text().trim()
  topic.tags = getReplyHeaderCells($)
    .find('a.tag[href^="/tag/"]')
    .map((_, element) => $(element).text().trim())
    .get()
  const topicIcon = selectTopicIcon($)
  topic.topicIcon = topicIcon ? new URL(topicIcon, baseUrl).toString() : ''
  topic.authorAvatar = header.find('.fr img.avatar').first().attr('src') || ''
  const headerMeta = header.find('.gray').first()
  const meta = headerMeta.text().split('·')
  topic.authorName = headerMeta.find('a[href^="/member/"]').first().text().trim()
  topic.isAuthorPro = headerMeta.find('.badges .badge.pro').length > 0
  const publishedTime = getV2exTimeSpan(headerMeta)
  topic.displayTime = publishedTime.text().trim()
  topic.publishedAt = formatTopicTime(publishedTime.attr('title'))
  topic.via =
    headerMeta
      .text()
      .match(/\bvia\s+([^·]+)/)?.[1]
      ?.trim() || undefined
  topic.visitCount = Number(
    meta.find(item => /(?:views|次点击)/i.test(item))?.match(/\d+/)?.[0] || 0
  )
  topic.outdatedNotice = findTopicElements(box, '.outdated').text().trim() || undefined
  topic.content =
    findTopicElements(box, '.topic_content')
      .filter((_, element) => !$(element).parents('.subtle').length)
      .first()
      .html() || ''
  findTopicElements(box, '.subtle').each((_, element) => {
    const label = findTopicElements($(element), '.fade').first()
    const time = getV2exTimeSpan(label).text().trim()
    topic.appends.push({
      time: time || label.text().split('·').slice(1).join('·').trim(),
      content: $(element).find('.topic_content').first().html() || ''
    })
  })

  topic.canViewInfo = headerMeta.find(`a[href="/t/${topicId}/info"]`).length > 0

  topic.contentActions = parseTopicContentActions($, topicId)
  const management = parseTopicManagement($, topicId)
  topic.managementActions = (['boost', 'fade'] as const).filter(action => !!management[action])

  const topicButtons = findTopicElements(box, '.topic_buttons').first()
  if (topicButtons.length) {
    const countStr = topicButtons.find('.topic_stats').text()
    if (/(\d+)\s*人收藏/.test(countStr)) {
      topic.collectCount = parseInt(RegExp.$1)
    }
    if (/(\d+)\s*人感谢/.test(countStr)) {
      topic.thankCount = parseInt(RegExp.$1)
    }
    const collectButton = topicButtons
      .find('a.tb')
      .filter((_, element) => /^(加入收藏|取消收藏)$/.test($(element).text().trim()))
      .first()
    topic.isCollected = collectButton.text().indexOf('取消收藏') >= 0
    topic.collectParamT = new URLSearchParams(
      collectButton.attr('href')?.split('?')[1]?.split('#')[0]
    ).get('t')
    const ignoreButton = topicButtons
      .find('a.tb')
      .filter((_, element) => /^(忽略主题|取消忽略)$/.test($(element).text().trim()))
      .first()
    topic.isIgnored = ignoreButton.text().trim() === '取消忽略'
    topic.canIgnore = ignoreButton.length > 0
    topic.canThank = topicButtons.find('#topic_thank').length > 0
    topic.isThanked = topicButtons.find('.topic_thanked').length > 0
  }

  topic.replyCount = parseReplyCount(getReplyHeaderCells($))
  return topic
}

/**
 * 获取回复列表
 * @param $ cheerio 实例
 */
export function parseReplies($: cheerio.CheerioAPI): TopicReply[] {
  const replies: TopicReply[] = []
  const topicBox = getTopicReplyBox($)
  topicBox
    .find('.cell[id^="r_"]')
    .filter((_, element) => !$(element).parents('.reply_content, [id^="r_"]').length)
    .each((_, element) => {
      if (!/^r_\d+$/.test($(element).attr('id') || '')) return
      // 正文可包含时间、链接和徽章同名结构，只从正文以外读取回复元信息
      const metadata = $(element).clone()
      metadata.find('.reply_content').remove()
      const replyTime = getV2exTimeSpan(metadata)
      const badges = metadata.find('.badges').first()
      const timeText = replyTime.text().trim()
      const viaMatch = timeText.match(/\s+via\s+(.+)$/)

      replies.push({
        replyId: $(element).attr('id')?.split('r_')[1] || '0',
        userAvatar: metadata.find('img.avatar').first().attr('src') || '',
        userName: metadata.find('a.dark').first().text() || '',
        isMod: badges.find('.badge.mod').length > 0,
        isOp: badges.find('.badge.op').length > 0,
        isPro: badges.find('.badge.pro').length > 0,
        time: viaMatch ? timeText.slice(0, viaMatch.index).trim() : timeText,
        via: viaMatch?.[1].trim(),
        repliedAt: formatTopicTime(replyTime.attr('title')),
        floor: metadata.find('span.no').first().text(),
        content: $(element).find('.reply_content').html() || '',
        thanks: parseInt(metadata.find('span.small.fade').first().text().trim() || '0'),
        thanked: metadata.find('.thank_area.thanked').length > 0
      })
    })
  return replies
}

/** 缺失或无效的源站时间保持为空，避免 dayjs(undefined) 生成当前时间 */
function formatTopicTime(value: string | undefined): string {
  if (!value) return ''
  const time = dayjs(value)
  return time.isValid() ? time.format('YYYY-MM-DD HH:mm:ss') : ''
}

/**
 * 解析回复总数
 * @param headerCells 回复区中不属于回复正文的统计单元格
 */
function parseReplyCount(headerCells: CheerioSelection): number {
  const headerText = headerCells.find('.gray').text()
  return Number(headerText.match(/(\d+)\s*条回复/)?.[1] || 0)
}

/**
 * 获取话题回复列表容器
 * @param $ cheerio 实例
 */
function getTopicReplyBox($: cheerio.CheerioAPI): CheerioSelection {
  return $('#topic-replies').first()
}

/** 回复统计和标签只从非回复单元格读取，允许容器内增加布局包装 */
function getReplyHeaderCells($: cheerio.CheerioAPI): CheerioSelection {
  return getTopicReplyBox($)
    .find('.cell')
    .filter(
      (_, element) =>
        !$(element).is('[id^="r_"]') && !$(element).parents('.reply_content, [id^="r_"]').length
    )
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
    const href = cells.eq(1).find('a[href]').first().attr('href')
    if (label) fields.push({ label, value, ...(href ? { href } : {}) })
  })
  if (!fields.some(field => field.label === 'ID' && field.value === String(topicId))) {
    throw new Error('无法读取帖子信息，请确认登录状态和访问权限后重试')
  }
  return { fields }
}

/** 只提取编辑所需原文，不能用主题页已渲染的 HTML 反推正文 */
export function parseTopicEditContent(
  html: string,
  topicId: number
): Pick<TopicContentState, 'title' | 'content' | 'syntax'> {
  const $ = cheerio.load(html)
  const form = $(`form[method="post"][action="/edit/topic/${topicId}"]`)
  const title = form.find('textarea[name="title"]')
  const content = form.find('textarea[name="content"]')
  const syntax = String(form.find('select[name="syntax"]').val() ?? '')
  if (!title.length || !content.length || !['0', '1'].includes(syntax)) {
    throw new Error(
      $('.problem, #error_message, .message').first().text().trim() ||
        $('#Main .inner').first().text().trim() ||
        '无法读取主题原文，请刷新后重试'
    )
  }
  return {
    title: decodeTextarea(String(title.val() ?? '')),
    content: decodeTextarea(String(content.val() ?? '')),
    syntax: syntax === '1' ? 'markdown' : 'default'
  }
}

/**
 * htmlparser2 10 保留 textarea 内的实体，直接读取 .val() 会把 &lt; 等转义文本带入编辑框
 * 实体只解码一次，例如 &amp;lt; 应恢复为 &lt;，不能继续变成 <
 * 升级 Cheerio / htmlparser2 时须核对 textarea 行为并运行对应回归测试，避免重复解码
 */
function decodeTextarea(raw: string): string {
  // 输入换行和空字符先标准化；首个 LF 在实体解码后移除，保留字符引用产生的 CR
  return decodeHTML(raw.replace(/\r\n?/g, '\n').replace(/\0/g, '\uFFFD')).replace(/^\n/, '')
}

/** 从主题头部读取编辑、移动和附言权限，不接受正文中的同名入口 */
export function parseTopicContentActions(
  $: cheerio.CheerioAPI,
  topicId: number
): TopicContentAction[] {
  const headerMeta = getTopicHeader($).find('.gray').first()
  return (['edit', 'move', 'append'] as const).filter(
    action => headerMeta.find(`a[href="/${action}/topic/${topicId}"]`).length > 0
  )
}

/** 按管理链接文字识别操作，独立校验路径与确认说明，不依赖 JavaScript 语句格式 */
export function parseTopicManagement($: cheerio.CheerioAPI, topicId: number) {
  const operations: Partial<
    Record<TopicManagementAction, TopicManagementState & { path: string }>
  > = {}
  $('#Main > .box > .inner > .fr > a[onclick]').each((_, element) => {
    const label = $(element)
      .text()
      .trim()
      .replace(/\s*[↑↓]$/, '')
      .trim()
    const action = label === '放到首页' ? 'boost' : label === '下沉' ? 'fade' : undefined
    if (!action) return

    // 只读取字符串，不执行脚本，也不依赖 if、confirm 或跳转函数的写法
    const script = $(element).attr('onclick') || ''
    const literals = Array.from(
      script.matchAll(/'([^'\\\r\n]*)'|"([^"\\\r\n]*)"/g),
      match => match[1] ?? match[2]
    )
    const pathname = action === 'boost' ? `/t/${topicId}/boost` : `/fade/topic/${topicId}`
    const hasEntry = literals.some(value => value.split(/[?#]/, 1)[0] === pathname)
    const confirmation = literals.find(
      value => value.includes(label) && (action === 'boost' ? /\d+\s*铜币/ : /\d+\s*天/).test(value)
    )
    // 无法读取费用或时长时不提供可提交入口，避免按过期说明执行操作
    if (hasEntry && confirmation) operations[action] = { path: pathname, confirmation }
  })
  return operations
}
