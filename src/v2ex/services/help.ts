import type { V2exSession } from '../session'
import type { HelpPage } from '../types'
import { parseHelpPage } from '../parsers/help'

/** 原站帮助文档读取服务 */
export class HelpService {
  constructor(private readonly session: V2exSession) {}

  /** 按主题实时获取帮助正文与目录 */
  async getPage(slug = 'home'): Promise<HelpPage> {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('帮助主题无效')
    const { data } = await this.session.get<string>(`/help/${slug}`)
    return parseHelpPage(data, slug)
  }
}
