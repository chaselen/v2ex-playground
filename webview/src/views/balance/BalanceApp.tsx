import { useEffect, useRef, useState } from 'react'
import { CircleHelp, Inbox, RefreshCw } from 'lucide-react'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import { normalizeHtml } from '@/core/contentEnhancement'
import CurrencyBalance from '@/components/CurrencyBalance'
import { Alert, Button, Empty, Pagination, Spinner } from '@/components/ui'
import { handleWebviewLinkClick } from '@/core/linkNavigation'
import PageSkeleton from '@/components/PageSkeleton'
import { createVsCodeClient, resolveWebviewUrl, subscribeWebviewState } from '@/core/vscode'
import { useLatestRequest } from '@/hooks/useLatestRequest'
import type {
  BalancePanelRpcCommands,
  BalancePanelViewState,
  BalancePanelWebviewEvents
} from '@extension/shared/webview'

/** 账户余额面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<BalancePanelRpcCommands, BalancePanelWebviewEvents>()

/**
 * 账户余额页面应用
 */
export default function BalanceApp() {
  const [state, setState] = useState<BalancePanelViewState>({ status: 'loading' })
  const [loadingPage, setLoadingPage] = useState(false)
  const scrollRef = useRef<SimpleBarCore | null>(null)
  const { startRequest } = useLatestRequest()
  const detail = state.detail

  /**
   * 刷新当前页
   */
  function refresh() {
    vscode.refresh()
  }

  /**
   * 加载指定流水页
   * @param page 页码
   */
  async function loadPage(page: number) {
    const request = startRequest()
    setLoadingPage(true)
    try {
      const nextDetail = await vscode.loadPage(page)
      if (!request.isLatest()) {
        return
      }
      setState({ status: 'balance', detail: nextDetail, showRefresh: true })
      scrollRef.current?.getScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error(err)
    } finally {
      if (request.isLatest()) {
        setLoadingPage(false)
      }
    }
  }

  /**
   * 渲染流水分页器
   * @param position 分页器位置
   */
  function renderPagination(position: 'top' | 'bottom') {
    if (!detail) {
      return null
    }

    return (
      <div className={`balance-pagination balance-pagination--${position}`}>
        <span className="balance-pagination-summary">
          第 {detail.page} 页，共 {detail.totalPage} 页
        </span>
        <Pagination
          className="balance-pagination-control"
          page={detail.page}
          totalPages={detail.totalPage}
          disabled={loadingPage}
          showQuickJumper
          onPageChange={loadPage}
        />
      </div>
    )
  }

  useEffect(() => {
    return subscribeWebviewState(
      handler => vscode.on('balanceStateChanged', data => handler(data.state)),
      () => vscode.ready(),
      setState
    )
  }, [])

  useEffect(() => {
    if (detail) {
      scrollRef.current?.recalculate()
    }
  }, [detail])

  return (
    <SimpleBar ref={scrollRef} className="balance-scroll" role="main" autoHide={false}>
      {state.status === 'loading' && <PageSkeleton variant="balance" rows={6} />}

      {state.status === 'error' && (
        <div className="balance-state">
          <Alert variant="danger" title="加载失败" description={state.message || '未知错误'} />
          <div className="balance-state-actions">
            {state.showLogin && (
              <Button size="small" variant="primary" onClick={() => vscode.login()}>
                登录
              </Button>
            )}
            {state.showRefresh && (
              <Button size="small" icon={<RefreshCw aria-hidden="true" />} onClick={refresh}>
                刷新页面
              </Button>
            )}
          </div>
        </div>
      )}

      {state.status === 'balance' && detail && (
        <article className="balance-container">
          <header className="balance-header">
            <div>
              <div className="balance-eyebrow">当前账户余额</div>
              <h1 className="balance-wallet" aria-label="当前账户余额">
                <CurrencyBalance
                  gold={detail.gold}
                  silver={detail.silver}
                  bronze={detail.bronze}
                  coinClassName="balance-coin"
                />
              </h1>
            </div>
            <div className="balance-actions">
              <Button
                size="small"
                onClick={() => vscode.openExternal(resolveWebviewUrl('/balance/add'))}
              >
                充值
              </Button>
              <Button
                size="small"
                variant="ghost"
                icon={<CircleHelp aria-hidden="true" />}
                onClick={() => vscode.openExternal(resolveWebviewUrl('/help/currency'))}
              >
                余额说明
              </Button>
              <Button
                size="small"
                variant="ghost"
                icon={<RefreshCw aria-hidden="true" />}
                loading={loadingPage}
                aria-label="刷新页面"
                onClick={refresh}
              />
            </div>
          </header>

          <section className="balance-ledger">
            {renderPagination('top')}
            <div className="balance-table-region" aria-busy={loadingPage}>
              {loadingPage && (
                <div className="balance-table-loading">
                  <Spinner aria-label="正在加载账户流水" />
                  <span>正在加载</span>
                </div>
              )}
              <div className="balance-table-scroller">
                <table className="balance-table">
                  <caption className="balance-table-caption">账户流水</caption>
                  <colgroup>
                    <col className="balance-table-time-column" />
                    <col className="balance-table-type-column" />
                    <col className="balance-table-amount-column" />
                    <col className="balance-table-balance-column" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">时间</th>
                      <th scope="col">类型</th>
                      <th className="balance-table-number" scope="col">
                        数额
                      </th>
                      <th className="balance-table-number" scope="col">
                        余额
                      </th>
                      <th scope="col">描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.transactions.length ? (
                      detail.transactions.map(transaction => (
                        <tr key={transaction.key}>
                          <td>
                            <span className="balance-time">{transaction.time}</span>
                          </td>
                          <td>{transaction.type}</td>
                          <td className="balance-table-number">
                            <strong
                              className={`balance-amount balance-amount--${transaction.direction}`}
                            >
                              {transaction.amount}
                            </strong>
                          </td>
                          <td className="balance-table-number">{transaction.balance}</td>
                          <td>
                            <div
                              className="topic-content balance-description"
                              onClick={handleWebviewLinkClick}
                              dangerouslySetInnerHTML={{
                                __html: normalizeHtml(transaction.descriptionHtml)
                              }}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="balance-table-empty" colSpan={5}>
                          <Empty
                            className="balance-table-empty-state"
                            icon={<Inbox aria-hidden="true" />}
                            title="暂无账户流水"
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {renderPagination('bottom')}
          </section>
        </article>
      )}
    </SimpleBar>
  )
}
