import { Fragment, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Banner,
  Button,
  Card,
  Collapse,
  DatePicker,
  Empty,
  Input,
  Pagination,
  Select,
  Spin
} from '@douyinfe/semi-ui'
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import dayjs from 'dayjs'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import { createVsCodeClient } from '../shared/vscode'
import type {
  SearchPanelRpcCommands,
  SearchPanelWebviewEvents,
  SoV2exHit,
  SoV2exOperator,
  SoV2exOrder,
  SoV2exSearchParams,
  SoV2exSearchResult,
  SoV2exSort
} from '../../../src/shared/webview'

/** 搜索面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<SearchPanelRpcCommands, SearchPanelWebviewEvents>()

/** 搜索结果每页数量 */
const searchPageSize = 20

/** 搜索排序选项 */
type SearchSortOption = 'relevance' | 'newest' | 'oldest'

/** 搜索筛选条件 */
interface SearchFilters {
  q: string
  sort: SearchSortOption
  operator: SoV2exOperator
  username: string
  node: string
  dateRange?: Date[]
}

/** 搜索页面状态 */
type SearchViewState =
  | { status: 'initial' }
  | { status: 'loading'; result?: SoV2exSearchResult }
  | { status: 'result'; result: SoV2exSearchResult }
  | { status: 'error'; message: string }

/** 初始搜索筛选条件 */
const initialFilters: SearchFilters = {
  q: '',
  sort: 'relevance',
  operator: 'or',
  username: '',
  node: ''
}

/** 搜索页面应用 */
export default function SearchApp() {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [state, setState] = useState<SearchViewState>({ status: 'initial' })
  const [currentPage, setCurrentPage] = useState(1)
  const requestIdRef = useRef(0)
  const scrollRef = useRef<SimpleBarCore | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const result = state.status === 'result' || state.status === 'loading' ? state.result : undefined
  const loading = state.status === 'loading'

  /**
   * 更新单个筛选条件
   * @param key 筛选字段
   * @param value 筛选值
   */
  function updateFilter<Key extends keyof SearchFilters>(key: Key, value: SearchFilters[Key]) {
    setFilters(current => ({ ...current, [key]: value }))
  }

  /**
   * 执行搜索
   * @param page 目标页码
   */
  async function search(page = 1) {
    const q = filters.q.trim()
    if (!q || loading) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setCurrentPage(page)
    setState(current => ({
      status: 'loading',
      result: current.status === 'result' ? current.result : undefined
    }))

    try {
      const nextResult = await vscode.search(createSearchParams(filters, page))
      if (requestId !== requestIdRef.current) {
        return
      }
      setState({ status: 'result', result: nextResult })
      scrollRef.current?.getScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return
      }
      setState({ status: 'error', message: (err as Error).message })
    }
  }

  /** 重置高级筛选 */
  function resetAdvancedFilters() {
    setFilters(current => ({
      ...initialFilters,
      q: current.q,
      sort: current.sort
    }))
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <SimpleBar ref={scrollRef} className="search-scroll" role="main" autoHide={false}>
      <main className="search-container">
        <header className="search-header">
          <div className="search-primary-controls">
            <Input
              ref={inputRef}
              className="search-query"
              value={filters.q}
              prefix={<IconSearch />}
              placeholder="搜索 V2EX 主题"
              showClear
              composition
              disabled={loading}
              onChange={value => updateFilter('q', value)}
              onEnterPress={() => search(1)}
            />
            <Select
              className="search-sort"
              value={filters.sort}
              disabled={loading}
              optionList={[
                { value: 'relevance', label: '相关度' },
                { value: 'newest', label: '最新发布' },
                { value: 'oldest', label: '最早发布' }
              ]}
              onChange={value => updateFilter('sort', value as SearchSortOption)}
            />
            <Button
              theme="solid"
              icon={<IconSearch />}
              loading={loading}
              disabled={!filters.q.trim()}
              onClick={() => search(1)}
            >
              搜索
            </Button>
          </div>

          <Collapse className="search-advanced" keepDOM>
            <Collapse.Panel
              itemKey="advanced"
              header="高级筛选"
              extra={
                <Button
                  size="small"
                  theme="borderless"
                  disabled={loading}
                  onClick={event => {
                    event.stopPropagation()
                    resetAdvancedFilters()
                  }}
                >
                  重置
                </Button>
              }
            >
              <div className="search-filter-grid">
                <label>
                  <span>关键词关系</span>
                  <Select
                    value={filters.operator}
                    disabled={loading}
                    optionList={[
                      { value: 'or', label: '包含任意关键词' },
                      { value: 'and', label: '包含全部关键词' }
                    ]}
                    onChange={value => updateFilter('operator', value as SoV2exOperator)}
                  />
                </label>
                <label>
                  <span>作者</span>
                  <Input
                    value={filters.username}
                    placeholder="完全匹配用户名"
                    showClear
                    disabled={loading}
                    onChange={value => updateFilter('username', value)}
                    onEnterPress={() => search(1)}
                  />
                </label>
                <label>
                  <span>节点</span>
                  <Input
                    value={filters.node}
                    placeholder="如 qna,-jobs"
                    showClear
                    disabled={loading}
                    onChange={value => updateFilter('node', value)}
                    onEnterPress={() => search(1)}
                  />
                </label>
                <label>
                  <span>发帖日期</span>
                  <DatePicker
                    type="dateRange"
                    value={filters.dateRange}
                    placeholder={['开始日期', '结束日期']}
                    disabled={loading}
                    onChange={date =>
                      updateFilter(
                        'dateRange',
                        Array.isArray(date) && date.every(item => item instanceof Date)
                          ? date
                          : undefined
                      )
                    }
                  />
                </label>
              </div>
            </Collapse.Panel>
          </Collapse>
        </header>

        {state.status === 'initial' && (
          <Empty
            className="search-state"
            image={<IllustrationNoContent />}
            darkModeImage={<IllustrationNoContentDark />}
            title="搜索 V2EX 主题"
            description="输入关键词后开始搜索，结果由 SoV2EX 提供"
          />
        )}

        {state.status === 'error' && (
          <div className="search-state">
            <Banner type="danger" title="搜索失败" description={state.message} />
            <Button
              size="small"
              theme="light"
              icon={<IconRefresh />}
              onClick={() => search(currentPage)}
            >
              重试
            </Button>
          </div>
        )}

        {result && (
          <section className="search-results" aria-busy={loading}>
            <div className="search-summary">
              <span>
                找到 {result.total.toLocaleString()} 个主题，耗时 {result.took} ms
              </span>
              {result.timedOut && (
                <Banner type="warning" description="搜索请求超时，结果可能不完整" />
              )}
            </div>

            {result.hits.length ? (
              <>
                <div className="search-result-list">
                  {result.hits.map(hit => (
                    <SearchResultCard key={hit.source.id} hit={hit} />
                  ))}
                </div>
                <Pagination
                  className="search-pagination"
                  currentPage={currentPage}
                  pageSize={searchPageSize}
                  total={result.total}
                  showQuickJumper
                  showTotal
                  disabled={loading}
                  onPageChange={page => search(page)}
                />
              </>
            ) : (
              <Empty
                className="search-state"
                image={<IllustrationNoContent />}
                darkModeImage={<IllustrationNoContentDark />}
                title="没有找到相关主题"
                description="尝试更换关键词或减少筛选条件"
              />
            )}

            {loading && (
              <div className="search-loading-mask">
                <Spin size="middle" />
              </div>
            )}
          </section>
        )}

        {loading && !result && (
          <div className="search-state search-state--loading">
            <Spin size="middle" />
            <span>搜索中</span>
          </div>
        )}
      </main>
    </SimpleBar>
  )
}

/**
 * 搜索结果卡片
 * @param props 卡片属性
 */
function SearchResultCard({ hit }: { hit: SoV2exHit }) {
  const { source } = hit
  const title = hit.highlight?.title?.[0] || source.title
  const excerpt = getHitExcerpt(hit)

  /**
   * 打开话题
   */
  function openTopic() {
    vscode.openTopic({ topicId: source.id, title: source.title })
  }

  /**
   * 打开用户
   * @param event 鼠标事件
   */
  function openMember(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    vscode.openMember({ username: source.member })
  }

  return (
    <Card className="search-result-card" headerLine={false}>
      <a
        className="search-result-title"
        href={`/t/${source.id}`}
        onClick={event => {
          event.preventDefault()
          event.stopPropagation()
          openTopic()
        }}
      >
        {renderHighlight(title)}
      </a>
      <div className="search-result-meta">
        <a href={`/member/${source.member}`} onClick={openMember}>
          @{source.member}
        </a>
        <span>{dayjs(source.created).format('YYYY-MM-DD HH:mm')}</span>
        <span>{source.replies} 条回复</span>
      </div>
      {excerpt && <p className="search-result-excerpt">{renderHighlight(excerpt)}</p>}
    </Card>
  )
}

/**
 * 创建 SoV2EX 搜索参数
 * @param filters 页面筛选条件
 * @param page 目标页码
 */
function createSearchParams(filters: SearchFilters, page: number): SoV2exSearchParams {
  const { sort, order } = mapSortOption(filters.sort)
  const params: SoV2exSearchParams = {
    q: filters.q.trim(),
    from: (page - 1) * searchPageSize,
    size: searchPageSize,
    sort,
    order,
    operator: filters.operator
  }

  const username = filters.username.trim()
  const node = filters.node.trim()
  if (username) {
    params.username = username
  }
  if (node) {
    params.node = node
  }
  if (filters.dateRange?.length === 2) {
    params.gte = dayjs(filters.dateRange[0]).startOf('day').unix()
    params.lte = dayjs(filters.dateRange[1]).endOf('day').unix()
  }

  return params
}

/**
 * 映射页面排序选项
 * @param option 页面排序选项
 */
function mapSortOption(option: SearchSortOption): { sort: SoV2exSort; order?: SoV2exOrder } {
  if (option === 'newest') {
    return { sort: 'created', order: 0 }
  }
  if (option === 'oldest') {
    return { sort: 'created', order: 1 }
  }
  return { sort: 'sumup' }
}

/**
 * 获取优先级最高的搜索命中摘要
 * @param hit 搜索命中项
 */
function getHitExcerpt(hit: SoV2exHit): string {
  return (
    hit.highlight?.content?.[0] ||
    hit.highlight?.['postscript_list.content']?.[0] ||
    hit.highlight?.['reply_list.content']?.[0] ||
    hit.source.content
  )
}

/**
 * 安全渲染 SoV2EX 的 em 高亮标记
 * @param content 高亮文本
 */
function renderHighlight(content: string): ReactNode {
  const parts = content.split(/(<\/?em>)/i)
  let highlighted = false

  return parts.map((part, index) => {
    if (/^<em>$/i.test(part)) {
      highlighted = true
      return null
    }
    if (/^<\/em>$/i.test(part)) {
      highlighted = false
      return null
    }

    return highlighted ? <mark key={index}>{part}</mark> : <Fragment key={index}>{part}</Fragment>
  })
}
