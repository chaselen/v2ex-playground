import { useEffect, useMemo, useRef, useState } from 'react'
import { Banner, Button, Empty, Pagination, Spin, Table } from '@douyinfe/semi-ui'
import { IconHelpCircle, IconRefresh } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import { normalizeHtml } from '../shared/contentEnhancement'
import { handleWebviewLinkClick } from '../shared/linkNavigation'
import { createVsCodeClient, resolveWebviewUrl } from '../shared/vscode'
import type {
  BalanceDetail,
  BalancePanelRpcCommands,
  BalancePanelViewState,
  BalancePanelWebviewEvents,
  BalanceTransaction
} from '../../../src/shared/webview'

/** 账户余额面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<BalancePanelRpcCommands, BalancePanelWebviewEvents>()

/** V2EX 余额页固定流水条数 */
const balancePageSize = 20

/**
 * 账户余额页面应用
 */
export default function BalanceApp() {
  const [state, setState] = useState<BalancePanelViewState>({ status: 'loading' })
  const [loadingPage, setLoadingPage] = useState(false)
  const scrollRef = useRef<SimpleBarCore | null>(null)
  const requestIdRef = useRef(0)
  const detail = state.detail

  const columns = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'time',
        width: 190,
        render: (time: string) => <span className="balance-time">{time}</span>
      },
      {
        title: '类型',
        dataIndex: 'type',
        width: 130
      },
      {
        title: '数额',
        dataIndex: 'amount',
        width: 90,
        align: 'right' as const,
        render: (amount: string, transaction: BalanceTransaction) => (
          <strong className={`balance-amount balance-amount--${transaction.direction}`}>
            {amount}
          </strong>
        )
      },
      {
        title: '余额',
        dataIndex: 'balance',
        width: 110,
        align: 'right' as const
      },
      {
        title: '描述',
        dataIndex: 'descriptionHtml',
        render: (html: string) => (
          <div
            className="topic-content balance-description"
            onClick={handleWebviewLinkClick}
            dangerouslySetInnerHTML={{ __html: normalizeHtml(html) }}
          />
        )
      }
    ],
    []
  )

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
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoadingPage(true)
    try {
      const nextDetail = await vscode.loadPage({ page })
      if (requestId !== requestIdRef.current) {
        return
      }
      setState({ status: 'balance', detail: nextDetail, showRefresh: true })
      scrollRef.current?.getScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error(err)
    } finally {
      if (requestId === requestIdRef.current) {
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
      <Pagination
        className={`balance-pagination balance-pagination--${position}`}
        currentPage={detail.page}
        pageSize={balancePageSize}
        total={detail.totalPage * balancePageSize}
        showQuickJumper
        showTotal
        onPageChange={loadPage}
      />
    )
  }

  useEffect(() => {
    return vscode.on('balanceStateChanged', data => setState(data.state))
  }, [])

  useEffect(() => {
    if (detail) {
      scrollRef.current?.recalculate()
    }
  }, [detail])

  return (
    <SimpleBar ref={scrollRef} className="balance-scroll" role="main" autoHide={false}>
      {state.status === 'loading' && (
        <div className="balance-state balance-state--loading">
          <Spin size="middle" />
          <span>加载中</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="balance-state">
          <Banner type="danger" title="加载失败" description={state.message || '未知错误'} />
          <div className="balance-state-actions">
            {state.showLogin && (
              <Button size="small" theme="solid" onClick={() => vscode.login()}>
                登录
              </Button>
            )}
            {state.showRefresh && (
              <Button size="small" theme="light" icon={<IconRefresh />} onClick={refresh}>
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
                <span>{detail.gold}</span>
                <i className="balance-coin balance-coin--gold" />
                <span>{detail.silver}</span>
                <i className="balance-coin balance-coin--silver" />
                <span>{detail.bronze}</span>
                <i className="balance-coin balance-coin--bronze" />
              </h1>
            </div>
            <div className="balance-actions">
              <Button
                size="small"
                theme="light"
                onClick={() =>
                  vscode.openExternal({
                    path: resolveWebviewUrl('/balance/add')
                  })
                }
              >
                充值
              </Button>
              <Button
                size="small"
                theme="borderless"
                icon={<IconHelpCircle />}
                onClick={() =>
                  vscode.openExternal({
                    path: resolveWebviewUrl('/help/currency')
                  })
                }
              >
                余额说明
              </Button>
              <Button
                size="small"
                theme="borderless"
                icon={<IconRefresh />}
                loading={loadingPage}
                aria-label="刷新页面"
                onClick={refresh}
              />
            </div>
          </header>

          <section className="balance-ledger">
            {renderPagination('top')}
            <Table
              className="balance-table"
              rowKey="key"
              columns={columns}
              dataSource={detail.transactions}
              pagination={false}
              loading={loadingPage}
              empty={
                <Empty
                  image={<IllustrationNoContent />}
                  darkModeImage={<IllustrationNoContentDark />}
                  title="暂无账户流水"
                />
              }
            />
            {renderPagination('bottom')}
          </section>
        </article>
      )}
    </SimpleBar>
  )
}
