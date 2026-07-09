import * as cheerio from 'cheerio/slim'

/** Cheerio 选择结果 */
export type CheerioSelection = ReturnType<cheerio.CheerioAPI>

/** V2EX 时间元素查找选项 */
interface V2exTimeSpanOptions {
  /** 是否只查找直接子元素 */
  direct?: boolean
}

/**
 * 解析通用分页组件总页数
 * @param $ cheerio 实例
 */
export function parsePagerTotalPage($: cheerio.CheerioAPI): number {
  const pageNumbers = $('.ps_container a.page_current, .ps_container a.page_normal')
    .map((_, element) => Number($(element).text().trim()) || 0)
    .get()
  const inputMax = Number($('.ps_container input.page_input').attr('max') || 0)

  return Math.max(1, inputMax, ...pageNumbers)
}

/**
 * 查找 V2EX 时间元素
 * @param container 查找范围
 * @param options 查找选项
 */
export function getV2exTimeSpan(
  container: CheerioSelection,
  options: V2exTimeSpanOptions = {}
): CheerioSelection {
  const spans = options.direct ? container.children('span') : container.find('span')
  // V2EX 完整时间在 title 中，格式通常为 20xx-xx-xx xx:xx:xx +08:00
  const fullTimeSpan = spans.filter('[title^="20"]').last()
  if (fullTimeSpan.length) {
    return fullTimeSpan
  }

  return spans.filter('[title]').last()
}
