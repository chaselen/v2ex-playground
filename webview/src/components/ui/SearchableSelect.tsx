import { Combobox } from '@base-ui/react/combobox'
import { Check } from 'lucide-react'
import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type Ref
} from 'react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import type { SelectOption } from './Select'
import { ScrollArea } from './ScrollArea'

/** 支持输入过滤的下拉选项 */
export interface SearchableSelectOption extends SelectOption {
  /** 用于输入匹配的纯文本 */
  searchText: string
}

/** 搜索下拉框属性，触发按钮由调用方提供 */
export interface SearchableSelectProps {
  value?: string
  options: SearchableSelectOption[]
  trigger: ReactElement
  disabled?: boolean
  loading?: boolean
  error?: string
  /** 固定选项高度；启用后仅渲染可见区域与附近选项 */
  virtualItemHeight?: number
  onOpenChange?: (open: boolean) => void
  onValueChange?: (value: string) => void
}

/** 输入位于浮层内的单选下拉框，复用 Select 的主题和键盘交互 */
export function SearchableSelect({
  value,
  options,
  trigger,
  disabled,
  loading,
  error,
  virtualItemHeight,
  onOpenChange,
  onValueChange
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, HTMLDivElement> | null>(null)

  return (
    <Combobox.Root<SearchableSelectOption>
      items={options}
      open={open}
      virtualized={!!virtualItemHeight}
      onItemHighlighted={(item, { reason, index }) => {
        if (virtualItemHeight && item && reason !== 'pointer') {
          virtualizerRef.current?.scrollToIndex(index, { align: 'auto' })
        }
      }}
      value={options.find(option => option.value === value) ?? null}
      disabled={disabled}
      isItemEqualToValue={(item, value) => item.value === value.value}
      autoHighlight
      itemToStringLabel={option => option.searchText}
      filter={(option, query) =>
        option.searchText.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }
      onOpenChange={nextOpen => {
        setOpen(nextOpen)
        onOpenChange?.(nextOpen)
      }}
      onValueChange={value => {
        if (value) onValueChange?.(value.value)
      }}
    >
      <Combobox.Trigger render={trigger} />
      <Combobox.Portal>
        <Combobox.Positioner
          className="v2ex-floating-positioner"
          align="start"
          sideOffset={4}
          collisionPadding={8}
        >
          <Combobox.Popup className="v2ex-select__content v2ex-searchable-select">
            <div className="v2ex-searchable-select__search">
              <Combobox.Input
                className="v2ex-searchable-select__input"
                aria-label="过滤选项"
                placeholder="输入标题或名称过滤"
              />
            </div>
            {(loading || error) && (
              <div className="v2ex-searchable-select__status" role="status">
                {error || '加载中…'}
              </div>
            )}
            <Combobox.Empty>
              {!loading && !error && (
                <div className="v2ex-searchable-select__status">没有匹配的选项</div>
              )}
            </Combobox.Empty>
            {virtualItemHeight ? (
              <VirtualizedOptions
                open={open}
                value={value}
                itemHeight={virtualItemHeight}
                virtualizerRef={virtualizerRef}
              />
            ) : (
              <ScrollArea className="v2ex-searchable-select__scroll">
                <Combobox.List className="v2ex-searchable-select__list">
                  {(option: SearchableSelectOption) => (
                    <Combobox.Item
                      className="v2ex-select__item"
                      key={option.value}
                      value={option}
                      disabled={option.disabled}
                    >
                      <Combobox.ItemIndicator className="v2ex-select__indicator">
                        <Check aria-hidden="true" />
                      </Combobox.ItemIndicator>
                      {option.label}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </ScrollArea>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

/** 使用 Base UI 的过滤结果，保留完整列表的键盘索引和无障碍位置信息 */
function VirtualizedOptions({
  open,
  value,
  itemHeight,
  virtualizerRef
}: {
  open: boolean
  value?: string
  itemHeight: number
  virtualizerRef: Ref<Virtualizer<HTMLDivElement, HTMLDivElement>>
}) {
  const items = Combobox.useFilteredItems<SearchableSelectOption>()
  const viewportRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    enabled: open,
    count: items.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => itemHeight,
    getItemKey: index => items[index].value,
    overscan: 4,
    paddingStart: 4,
    paddingEnd: 4,
    scrollPaddingStart: 4,
    scrollPaddingEnd: 4
  })
  useImperativeHandle(virtualizerRef, () => virtualizer, [virtualizer])
  const positioned = useRef(false)
  useLayoutEffect(() => {
    if (!open || positioned.current) return
    const selectedIndex = items.findIndex(item => item.value === value)
    if (selectedIndex < 0) return
    // 节点可能在浮层打开后才加载；只在首次就绪时定位，避免后续抢占搜索和滚动位置
    virtualizer.scrollToIndex(selectedIndex, { align: 'auto' })
    positioned.current = true
  }, [items, open, value, virtualizer])

  return (
    <ScrollArea
      className="v2ex-searchable-select__scroll v2ex-searchable-select__virtual-scroll"
      viewportRef={viewportRef}
      style={{ height: Math.min(320, virtualizer.getTotalSize()) }}
    >
      <Combobox.List
        className="v2ex-searchable-select__virtual-list"
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map(row => {
          const option = items[row.index]
          return (
            <Combobox.Item
              className="v2ex-select__item"
              key={option.value}
              index={row.index}
              value={option}
              disabled={option.disabled}
              aria-setsize={items.length}
              aria-posinset={row.index + 1}
              style={{
                position: 'absolute',
                top: 0,
                left: 4,
                width: 'calc(100% - 8px)',
                height: itemHeight,
                boxSizing: 'border-box',
                transform: `translateY(${row.start}px)`
              }}
            >
              <Combobox.ItemIndicator className="v2ex-select__indicator">
                <Check aria-hidden="true" />
              </Combobox.ItemIndicator>
              {option.label}
            </Combobox.Item>
          )
        })}
      </Combobox.List>
    </ScrollArea>
  )
}
