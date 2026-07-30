import { Tabs as TabsPrimitive } from 'radix-ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode
} from 'react'
import { Button } from './Button'
import { mergeClassNames } from './utils'

export interface TabsProps extends Omit<
  ComponentProps<typeof TabsPrimitive.Root>,
  'onValueChange'
> {
  /** 标签切换回调 */
  onValueChange?: (value: string) => void
}

/** 基于 Radix Tabs 的受控标签容器 */
export function Tabs({ className, orientation = 'horizontal', ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root
      className={mergeClassNames('v2ex-tabs', className)}
      orientation={orientation}
      {...props}
    />
  )
}

export interface TabsListProps extends Omit<ComponentProps<typeof TabsPrimitive.List>, 'ref'> {
  /** 标签栏右侧附加内容 */
  extra?: ReactNode
  /** 溢出时显示横向滚动按钮 */
  overflowNavigation?: boolean
}

interface TabsOverflowState {
  /** 是否存在溢出 */
  overflow: boolean
  /** 是否可以向前滚动 */
  canScrollBack: boolean
  /** 是否可以向后滚动 */
  canScrollForward: boolean
}

const initialOverflowState: TabsOverflowState = {
  overflow: false,
  canScrollBack: false,
  canScrollForward: false
}

/** 标签列表、可选溢出导航及工具区 */
export function TabsList({
  children,
  className,
  extra,
  overflowNavigation = false,
  ...props
}: TabsListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [overflowState, setOverflowState] = useState<TabsOverflowState>(initialOverflowState)

  /** 更新标签列表溢出状态 */
  const updateOverflowState = useCallback(() => {
    const list = listRef.current
    const bar = list?.parentElement
    if (!list || !bar || !overflowNavigation) {
      return
    }

    // 用「不含滚动按钮」的可用宽度判断是否溢出，避免按钮占用空间后无法回退
    const barStyle = getComputedStyle(bar)
    const barPadding =
      (Number.parseFloat(barStyle.paddingLeft) || 0) +
      (Number.parseFloat(barStyle.paddingRight) || 0)
    const extra = bar.querySelector<HTMLElement>(':scope > .v2ex-tabs__extra')
    const extraWidth = extra?.offsetWidth ?? 0
    const availableWithoutNav = Math.max(0, bar.clientWidth - barPadding - extraWidth)
    const overflow = list.scrollWidth > availableWithoutNav + 1

    if (!overflow && list.scrollLeft !== 0) {
      list.scrollLeft = 0
    }

    const maxScrollLeft = Math.max(0, list.scrollWidth - list.clientWidth)
    const nextState: TabsOverflowState = {
      overflow,
      canScrollBack: overflow && list.scrollLeft > 1,
      canScrollForward: overflow && list.scrollLeft < maxScrollLeft - 1
    }

    setOverflowState(current =>
      current.overflow === nextState.overflow &&
      current.canScrollBack === nextState.canScrollBack &&
      current.canScrollForward === nextState.canScrollForward
        ? current
        : nextState
    )
  }, [overflowNavigation])

  /** 将指定标签滚动到可视区域 */
  const scrollTabIntoView = useCallback((tab: HTMLElement, behavior: ScrollBehavior) => {
    const list = listRef.current
    if (!list) {
      return
    }

    const listRect = list.getBoundingClientRect()
    const tabRect = tab.getBoundingClientRect()
    const leftDelta = tabRect.left - listRect.left
    const rightDelta = tabRect.right - listRect.right

    if (leftDelta < -1) {
      list.scrollBy({ left: leftDelta, behavior })
    } else if (rightDelta > 1) {
      list.scrollBy({ left: rightDelta, behavior })
    }
  }, [])

  /** 滚动到下一个未完全显示的标签 */
  function scrollOverflow(direction: 'back' | 'forward') {
    const list = listRef.current
    if (!list) {
      return
    }

    const listRect = list.getBoundingClientRect()
    const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'))
    const target =
      direction === 'back'
        ? tabs.reverse().find(tab => tab.getBoundingClientRect().left < listRect.left - 1)
        : tabs.find(tab => tab.getBoundingClientRect().right > listRect.right + 1)

    if (target) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth'
      scrollTabIntoView(target, behavior)
    }
  }

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !overflowNavigation) {
      setOverflowState(initialOverflowState)
      return
    }

    let frame = 0
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const activeTab = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
        if (activeTab) {
          scrollTabIntoView(activeTab, 'auto')
        }
        updateOverflowState()
      })
    }
    const resizeObserver = new ResizeObserver(scheduleUpdate)
    const mutationObserver = new MutationObserver(scheduleUpdate)

    resizeObserver.observe(list)
    mutationObserver.observe(list, {
      attributes: true,
      attributeFilter: ['data-state'],
      childList: true,
      subtree: true
    })
    list.addEventListener('scroll', updateOverflowState, { passive: true })
    scheduleUpdate()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      list.removeEventListener('scroll', updateOverflowState)
    }
  }, [overflowNavigation, scrollTabIntoView, updateOverflowState])

  return (
    <div className={mergeClassNames('v2ex-tabs__bar', className)}>
      {overflowState.overflow && (
        <Button
          type="button"
          className="v2ex-tabs__scroll-button"
          variant="ghost"
          size="small"
          icon={<ChevronLeft aria-hidden="true" />}
          disabled={!overflowState.canScrollBack}
          aria-label="向左滚动标签"
          title="向左滚动标签"
          onClick={() => scrollOverflow('back')}
        />
      )}
      <TabsPrimitive.List ref={listRef} className="v2ex-tabs__list" {...props}>
        {children}
      </TabsPrimitive.List>
      {overflowState.overflow && (
        <Button
          type="button"
          className="v2ex-tabs__scroll-button"
          variant="ghost"
          size="small"
          icon={<ChevronRight aria-hidden="true" />}
          disabled={!overflowState.canScrollForward}
          aria-label="向右滚动标签"
          title="向右滚动标签"
          onClick={() => scrollOverflow('forward')}
        />
      )}
      {extra && <div className="v2ex-tabs__extra">{extra}</div>}
    </div>
  )
}

/** 单个标签按钮 */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={mergeClassNames('v2ex-tabs__trigger', className)}
      {...props}
    />
  )
}

/** 标签内容 */
export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={mergeClassNames('v2ex-tabs__content', className)}
      {...props}
    />
  )
}
