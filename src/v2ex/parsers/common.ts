import * as cheerio from 'cheerio/slim'

/** Cheerio 选择结果 */
export type CheerioSelection = ReturnType<cheerio.CheerioAPI>

/** 查找页面结构元素，排除用户正文和通知附带内容中的同名结构 */
export function findOutsideRichText(
  container: CheerioSelection,
  selector: string
): CheerioSelection {
  return container
    .find(selector)
    .not('.topic_content, .topic_content *, .reply_content, .reply_content *, .payload, .payload *')
}

/**
 * 解析通用分页组件总页数
 * @param $ cheerio 实例
 * @param scope 页面自身的分页区域，排除侧栏与富文本中的分页结构
 */
export function parsePagerTotalPage(
  $: cheerio.CheerioAPI,
  scope: CheerioSelection = $.root()
): number {
  const pageNumbers = findOutsideRichText(
    scope,
    '.ps_container .page_current, .ps_container .page_normal'
  )
    .map((_, element) => Number($(element).text().trim()) || 0)
    .get()
  const inputMax = Math.max(
    0,
    ...findOutsideRichText(scope, '.ps_container input.page_input')
      .map((_, element) => Number($(element).attr('max')) || 0)
      .get()
  )

  return Math.max(1, inputMax, ...pageNumbers)
}

/**
 * 查找 V2EX 时间元素
 * @param container 查找范围
 */
export function getV2exTimeSpan(container: CheerioSelection): CheerioSelection {
  const spans = findOutsideRichText(container, 'span')
  // V2EX 完整时间在 title 中，格式通常为 20xx-xx-xx xx:xx:xx +08:00
  const fullTimeSpan = spans
    .filter(
      (_, element) =>
        element.type === 'tag' &&
        /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(element.attribs.title || '')
    )
    .first()
  if (fullTimeSpan.length) {
    return fullTimeSpan
  }

  return spans.filter('.ago').first()
}
