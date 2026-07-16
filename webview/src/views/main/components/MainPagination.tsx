import { Pagination } from '@douyinfe/semi-ui'
import styles from './MainPagination.module.scss'

interface MainPaginationProps {
  /** 当前页码 */
  currentPage: number
  /** 总页数 */
  totalPage: number
  /** 总条数 */
  totalCount?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 页码变化回调 */
  onPageChange: (page: number) => void
}

/**
 * 主面板分页器
 * @param props 组件参数
 */
export default function MainPagination(props: MainPaginationProps) {
  const { currentPage, totalPage, totalCount, disabled, onPageChange } = props
  const showTotalCount = typeof totalCount === 'number' && totalCount > 0
  const totalCountText = showTotalCount ? totalCount.toLocaleString('en-US') : ''

  return (
    <div className={styles['main-pagination']}>
      <Pagination
        size="small"
        pageSize={1}
        total={totalPage}
        currentPage={currentPage}
        disabled={disabled}
        hoverShowPageSelect
        onPageChange={onPageChange}
      />
      {showTotalCount && (
        <span className={styles['main-pagination-summary']}>{`共 ${totalCountText} 条`}</span>
      )}
    </div>
  )
}
