import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import { Button } from './Button'
import { HoverCard } from './HoverCard'
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
  /** 紧凑模式只展示前后按钮和当前页；hover 页码可快速切换 */
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

  const buttonSize = compact ? 'small' : 'default'

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
        size={buttonSize}
        variant="ghost"
        icon={<ChevronLeft aria-hidden="true" />}
        aria-label="上一页"
        disabled={disabled || normalizedPage <= 1}
        onClick={() => changePage(normalizedPage - 1)}
      />

      {compact ? (
        <CompactPageSelect
          page={normalizedPage}
          totalPages={normalizedTotal}
          disabled={disabled}
          onPageChange={changePage}
        />
      ) : (
        items.map(item =>
          typeof item === 'number' ? (
            <Button
              className={mergeClassNames(
                'v2ex-pagination__button',
                item === normalizedPage && 'v2ex-pagination__button--active'
              )}
              size={buttonSize}
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
        size={buttonSize}
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
            inputMode="numeric"
            onChange={event => setJumpValue(event.currentTarget.value)}
            onKeyDown={jump}
          />
          <span>页</span>
        </label>
      )}
    </nav>
  )
}

interface CompactPageSelectProps {
  page: number
  totalPages: number
  disabled: boolean
  onPageChange: (page: number) => void
}

/**
 * 紧凑模式页码：hover 时弹出页码列表快速切换
 * 交互参考 Semi UI Pagination 的 hoverShowPageSelect
 */
function CompactPageSelect({ disabled, onPageChange, page, totalPages }: CompactPageSelectProps) {
  const [open, setOpen] = useState(false)
  const currentItemRef = useRef<HTMLButtonElement>(null)
  const canSelect = !disabled && totalPages > 1

  useEffect(() => {
    if (!open) {
      return
    }

    // 浮层挂载后再对齐当前页，避免首帧高度未计算完成
    const frame = requestAnimationFrame(() => {
      currentItemRef.current?.scrollIntoView({ block: 'nearest' })
    })

    return () => cancelAnimationFrame(frame)
  }, [open, page])

  const label = (
    <button
      type="button"
      className={mergeClassNames(
        'v2ex-pagination__compact-label',
        canSelect && 'v2ex-pagination__compact-label--interactive',
        open && 'v2ex-pagination__compact-label--open'
      )}
      disabled={!canSelect}
      aria-label={`第 ${page} 页，共 ${totalPages} 页`}
      aria-haspopup={canSelect ? 'listbox' : undefined}
      aria-expanded={canSelect ? open : undefined}
    >
      {page} / {totalPages}
    </button>
  )

  if (!canSelect) {
    return label
  }

  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={180}
      closeDelay={120}
      side="bottom"
      align="center"
      showArrow={false}
      className="v2ex-pagination__page-select"
      content={
        <ScrollAreaPrimitive.Root className="v2ex-pagination__page-select-list" type="hover">
          <ScrollAreaPrimitive.Viewport
            className="v2ex-pagination__page-select-viewport"
            role="listbox"
            aria-label="选择页码"
          >
            <div className="v2ex-pagination__page-select-content">
              {Array.from({ length: totalPages }, (_, index) => {
                const itemPage = index + 1
                const isActive = itemPage === page

                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    aria-label={`第 ${itemPage} 页`}
                    className={mergeClassNames(
                      'v2ex-pagination__page-select-item',
                      isActive && 'v2ex-pagination__page-select-item--active'
                    )}
                    ref={isActive ? currentItemRef : undefined}
                    key={itemPage}
                    onClick={() => {
                      onPageChange(itemPage)
                      setOpen(false)
                    }}
                  >
                    {itemPage}
                  </button>
                )
              })}
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.Scrollbar
            className="v2ex-pagination__page-select-scrollbar"
            orientation="vertical"
          >
            <ScrollAreaPrimitive.Thumb className="v2ex-pagination__page-select-thumb" />
          </ScrollAreaPrimitive.Scrollbar>
        </ScrollAreaPrimitive.Root>
      }
    >
      {label}
    </HoverCard>
  )
}

/** 将页码限制在有效范围内 */
function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(1, page), totalPages)
}

/**
 * 生成分页页码列表
 * - 总页数不超过 8 时全部展示
 * - 否则保留首尾页，当前页左右各 2 页；靠近两端时展开窗口避免过早出现省略号
 */
function getPaginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 8) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const siblings = 2
  const items: PaginationItem[] = [1]
  // 靠两端时中间窗口跨度（比 siblings*2+2 少一页）
  const edgeWindowEnd = 1 + siblings * 2

  let windowStart = Math.max(2, page - siblings)
  let windowEnd = Math.min(totalPages - 1, page + siblings)

  // 靠近首页：展开右侧窗口，如 1 2 3 4 5 … N
  if (page - siblings <= 2) {
    windowStart = 2
    windowEnd = Math.min(totalPages - 1, edgeWindowEnd)
  }

  // 靠近末页：展开左侧窗口，如 1 … N-4 N-3 N-2 N-1 N
  if (page + siblings >= totalPages - 1) {
    windowEnd = totalPages - 1
    windowStart = Math.max(2, totalPages - edgeWindowEnd)
  }

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
