import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { Button } from './Button'
import { mergeClassNames } from './utils'

export interface PaginationProps {
  /** 当前页码，从 1 开始 */
  page: number
  /** 总页数 */
  totalPages: number
  /** 是否禁用翻页 */
  disabled?: boolean
  /** 只有一页时是否隐藏 */
  hideOnSinglePage?: boolean
  /** 是否显示快速跳页 */
  showQuickJumper?: boolean
  /** 紧凑模式只展示前后按钮和当前页 */
  compact?: boolean
  /** 附加类名 */
  className?: string
  /** 页码变化回调 */
  onPageChange: (page: number) => void | Promise<void>
}

type PaginationItem = number | 'left-ellipsis' | 'right-ellipsis'

/** 使用 VS Code Theme Color 的分页器 */
export function Pagination({
  className,
  compact = false,
  disabled = false,
  hideOnSinglePage = false,
  onPageChange,
  page,
  showQuickJumper = false,
  totalPages
}: PaginationProps) {
  const normalizedTotal = Math.max(1, totalPages)
  const normalizedPage = clampPage(page, normalizedTotal)
  const [jumpValue, setJumpValue] = useState(String(normalizedPage))

  useEffect(() => {
    setJumpValue(String(normalizedPage))
  }, [normalizedPage])

  if (hideOnSinglePage && normalizedTotal <= 1) {
    return null
  }

  const items = compact ? [] : getPaginationItems(normalizedPage, normalizedTotal)

  function changePage(nextPage: number) {
    const normalizedNextPage = clampPage(nextPage, normalizedTotal)
    if (!disabled && normalizedNextPage !== normalizedPage) {
      void onPageChange(normalizedNextPage)
    }
  }

  function jump(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    const nextPage = Number.parseInt(jumpValue, 10)
    if (Number.isFinite(nextPage)) {
      changePage(nextPage)
      setJumpValue(String(clampPage(nextPage, normalizedTotal)))
    }
  }

  return (
    <nav
      className={mergeClassNames(
        'v2ex-pagination',
        compact && 'v2ex-pagination--compact',
        className
      )}
      aria-label="分页"
    >
      <Button
        className="v2ex-pagination__button"
        size="small"
        variant="ghost"
        icon={<ChevronLeft aria-hidden="true" />}
        aria-label="上一页"
        disabled={disabled || normalizedPage <= 1}
        onClick={() => changePage(normalizedPage - 1)}
      />

      {compact ? (
        <span className="v2ex-pagination__compact-label">
          {normalizedPage} / {normalizedTotal}
        </span>
      ) : (
        items.map(item =>
          typeof item === 'number' ? (
            <Button
              className={mergeClassNames(
                'v2ex-pagination__button',
                item === normalizedPage && 'v2ex-pagination__button--active'
              )}
              size="small"
              variant="ghost"
              aria-current={item === normalizedPage ? 'page' : undefined}
              aria-label={`第 ${item} 页`}
              disabled={disabled}
              onClick={() => changePage(item)}
              key={item}
            >
              {item}
            </Button>
          ) : (
            <span className="v2ex-pagination__ellipsis" aria-hidden="true" key={item}>
              …
            </span>
          )
        )
      )}

      <Button
        className="v2ex-pagination__button"
        size="small"
        variant="ghost"
        icon={<ChevronRight aria-hidden="true" />}
        aria-label="下一页"
        disabled={disabled || normalizedPage >= normalizedTotal}
        onClick={() => changePage(normalizedPage + 1)}
      />

      {showQuickJumper && normalizedTotal > 1 && (
        <label className="v2ex-pagination__jumper">
          <span>跳至</span>
          <input
            type="number"
            min={1}
            max={normalizedTotal}
            disabled={disabled}
            value={jumpValue}
            aria-label="跳转页码"
            onChange={event => setJumpValue(event.currentTarget.value)}
            onKeyDown={jump}
          />
          <span>页</span>
        </label>
      )}
    </nav>
  )
}

/** 将页码限制在有效范围内 */
function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(1, page), totalPages)
}

/** 生成包含首尾页和当前页邻近项的分页列表 */
function getPaginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: PaginationItem[] = [1]
  const windowStart = Math.max(2, page - 1)
  const windowEnd = Math.min(totalPages - 1, page + 1)

  if (windowStart > 2) {
    items.push('left-ellipsis')
  }

  for (let current = windowStart; current <= windowEnd; current += 1) {
    items.push(current)
  }

  if (windowEnd < totalPages - 1) {
    items.push('right-ellipsis')
  }

  items.push(totalPages)
  return items
}
