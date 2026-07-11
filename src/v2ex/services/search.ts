import type { V2exSession } from '../session'
import type { SoV2exSearchParams, SoV2exSearchResult } from '../types'

/** SoV2EX 搜索领域服务 */
export class SearchService {
  constructor(private readonly session: V2exSession) {}

  /** 搜索 V2EX 内容 */
  async search(params: SoV2exSearchParams): Promise<SoV2exSearchResult> {
    const { data } = await this.session.get<{
      took?: unknown
      timed_out?: unknown
      total?: unknown
      hits?: Array<{
        _source: SoV2exSearchResult['hits'][number]['source']
        highlight?: object
      }>
    }>('https://www.sov2ex.com/api/search', { params })
    const hits: Array<{
      _source: SoV2exSearchResult['hits'][number]['source']
      highlight?: object
    }> = data.hits || []

    return {
      took: Number(data.took) || 0,
      timedOut: Boolean(data.timed_out),
      total: Number(data.total) || 0,
      hits: hits.map(hit => ({ source: hit._source, highlight: hit.highlight }))
    }
  }
}
