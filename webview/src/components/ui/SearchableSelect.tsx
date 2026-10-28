import { Combobox } from '@base-ui/react/combobox'
import { Check } from 'lucide-react'
import type { ReactElement } from 'react'
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
  onOpenChange,
  onValueChange
}: SearchableSelectProps) {
  return (
    <Combobox.Root<SearchableSelectOption>
      items={options}
      value={options.find(option => option.value === value) ?? null}
      disabled={disabled}
      isItemEqualToValue={(item, value) => item.value === value.value}
      autoHighlight
      itemToStringLabel={option => option.searchText}
      filter={(option, query) =>
        option.searchText.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }
      onOpenChange={onOpenChange}
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
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
