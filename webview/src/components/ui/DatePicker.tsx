import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { Button } from './Button'
import { Popover } from './Popover'
import { mergeClassNames } from './utils'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
const VALUE_FORMAT = 'YYYY-MM-DD'
const DISPLAY_FORMAT = 'YYYY/MM/DD'

export interface DatePickerProps {
  /** 当前值，格式 YYYY-MM-DD */
  value?: string
  /** 占位文案 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 无障碍名称 */
  'aria-label'?: string
  /** 附加类名 */
  className?: string
  /** 值变化；清空时传空字符串 */
  onValueChange?: (value: string) => void
}

function parseValue(value?: string): Dayjs | null {
  if (!value) {
    return null
  }
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.startOf('day') : null
}

function buildCalendarDays(viewMonth: Dayjs): Dayjs[] {
  const monthStart = viewMonth.startOf('month')
  const gridStart = monthStart.subtract(monthStart.day(), 'day')
  return Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'))
}

/** 主题化日期选择器；替代原生 type=date 的宿主日历弹出层 */
export function DatePicker({
  className,
  disabled = false,
  placeholder = '选择日期',
  value = '',
  onValueChange,
  ...props
}: DatePickerProps) {
  const selected = useMemo(() => parseValue(value), [value])
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => (selected ?? dayjs()).startOf('month'))

  useEffect(() => {
    if (open) {
      setViewMonth((selected ?? dayjs()).startOf('month'))
    }
  }, [open, selected])

  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth])
  const today = dayjs().startOf('day')
  const display = selected ? selected.format(DISPLAY_FORMAT) : ''

  function selectDay(day: Dayjs) {
    onValueChange?.(day.format(VALUE_FORMAT))
    setOpen(false)
  }

  function clearValue() {
    onValueChange?.('')
    setOpen(false)
  }

  function selectToday() {
    selectDay(today)
  }

  const panel = (
    <div className="v2ex-date-picker__panel">
      <div className="v2ex-date-picker__header">
        <button
          type="button"
          className="v2ex-date-picker__nav"
          aria-label="上个月"
          onClick={() => setViewMonth(current => current.subtract(1, 'month'))}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="v2ex-date-picker__title" aria-live="polite">
          {viewMonth.format('YYYY年M月')}
        </div>
        <button
          type="button"
          className="v2ex-date-picker__nav"
          aria-label="下个月"
          onClick={() => setViewMonth(current => current.add(1, 'month'))}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="v2ex-date-picker__weekdays" aria-hidden="true">
        {WEEKDAYS.map(label => (
          <span key={label} className="v2ex-date-picker__weekday">
            {label}
          </span>
        ))}
      </div>

      <div
        className="v2ex-date-picker__days"
        role="grid"
        aria-label={viewMonth.format('YYYY年M月')}
      >
        {days.map(day => {
          const key = day.format(VALUE_FORMAT)
          const inMonth = day.month() === viewMonth.month()
          const isSelected = selected?.isSame(day, 'day') ?? false
          const isToday = day.isSame(today, 'day')

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-label={day.format('YYYY年M月D日')}
              aria-selected={isSelected}
              className={mergeClassNames(
                'v2ex-date-picker__day',
                !inMonth && 'v2ex-date-picker__day--outside',
                isSelected && 'v2ex-date-picker__day--selected',
                isToday && !isSelected && 'v2ex-date-picker__day--today'
              )}
              onClick={() => selectDay(day)}
            >
              {day.date()}
            </button>
          )
        })}
      </div>

      <div className="v2ex-date-picker__footer">
        <Button type="button" size="small" variant="ghost" onClick={clearValue}>
          清除
        </Button>
        <Button type="button" size="small" variant="secondary" onClick={selectToday}>
          今天
        </Button>
      </div>
    </div>
  )

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (!disabled) {
          setOpen(next)
        }
      }}
      side="bottom"
      align="start"
      className="v2ex-date-picker__popover"
      content={panel}
    >
      <button
        type="button"
        className={mergeClassNames(
          'v2ex-date-picker',
          !display && 'v2ex-date-picker--placeholder',
          disabled && 'v2ex-date-picker--disabled',
          className
        )}
        disabled={disabled}
        aria-label={props['aria-label']}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="v2ex-date-picker__value">{display || placeholder}</span>
        <CalendarIcon className="v2ex-date-picker__icon" aria-hidden="true" />
      </button>
    </Popover>
  )
}
