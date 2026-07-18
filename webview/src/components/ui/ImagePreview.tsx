import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Shrink,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent
} from 'react'
import { Button } from './Button'
import { mergeClassNames } from './utils'

/** 图片平移位置 */
interface ImagePosition {
  x: number
  y: number
}

/** 图片拖拽起始状态 */
interface ImageDragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  maxX: number
  maxY: number
}

export interface ImagePreviewProps {
  /** 当前图片索引 */
  currentIndex: number
  /** 是否打开图片预览 */
  open: boolean
  /** 图片地址列表 */
  srcList: string[]
  /** 工具栏末尾的扩展内容 */
  toolbarExtra?: ReactNode
  /** 当前图片索引变化 */
  onCurrentIndexChange: (index: number) => void
  /** 打开状态变化 */
  onOpenChange: (open: boolean) => void
}

const INITIAL_POSITION: ImagePosition = { x: 0, y: 0 }

/** 支持切换、缩放、旋转和拖拽的通用图片预览 */
export function ImagePreview({
  currentIndex,
  open,
  srcList,
  toolbarExtra,
  onCurrentIndexChange,
  onOpenChange
}: ImagePreviewProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState<ImagePosition>(INITIAL_POSITION)
  const [isDragging, setIsDragging] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<ImageDragState | null>(null)
  const currentSrc = srcList[currentIndex]
  const imageCount = srcList.length

  useLayoutEffect(() => {
    setScale(1)
    setRotation(0)
    setPosition(INITIAL_POSITION)
    dragRef.current = null
    setIsDragging(false)
  }, [currentIndex, currentSrc, open])

  useEffect(() => {
    if (scale <= 1) {
      setPosition(INITIAL_POSITION)
    }
  }, [scale])

  /** 重置图片变换 */
  function resetTransform() {
    setScale(1)
    setRotation(0)
    setPosition(INITIAL_POSITION)
    dragRef.current = null
    setIsDragging(false)
  }

  /** 切换图片 */
  function changeImage(offset: number) {
    if (imageCount <= 1) {
      return
    }
    onCurrentIndexChange((currentIndex + offset + imageCount) % imageCount)
    resetTransform()
  }

  /** 调整缩放比例 */
  function zoom(offset: number) {
    setScale(current => Math.min(4, Math.max(0.25, Number((current + offset).toFixed(2)))))
  }

  /** 处理键盘快捷键 */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      changeImage(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      changeImage(1)
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoom(0.25)
    } else if (event.key === '-') {
      event.preventDefault()
      zoom(-0.25)
    } else if (event.key === '0') {
      event.preventDefault()
      resetTransform()
    }
  }

  /** 使用滚轮缩放图片 */
  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    zoom(event.deltaY < 0 ? 0.25 : -0.25)
  }

  /** 图片超出预览区域时开始拖拽 */
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const imageRect = imageRef.current?.getBoundingClientRect()
    const stageRect = event.currentTarget.getBoundingClientRect()
    const canDrag =
      imageRect &&
      (imageRect.width > stageRect.width + 1 || imageRect.height > stageRect.height + 1)

    if (event.button !== 0 || !canDrag) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      maxX: Math.max(0, (imageRect.width - stageRect.width) / 2),
      maxY: Math.max(0, (imageRect.height - stageRect.height) / 2)
    }
    setIsDragging(true)
  }

  /** 拖拽平移超出预览区域的图片 */
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    setPosition({
      x: Math.min(drag.maxX, Math.max(-drag.maxX, drag.originX + event.clientX - drag.startX)),
      y: Math.min(drag.maxY, Math.max(-drag.maxY, drag.originY + event.clientY - drag.startY))
    })
  }

  /** 结束图片拖拽 */
  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return
    }

    dragRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          resetTransform()
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="v2ex-image-preview__overlay" />
        <DialogPrimitive.Content
          className="v2ex-image-preview"
          aria-describedby={undefined}
          onKeyDown={handleKeyDown}
        >
          <DialogPrimitive.Title className="v2ex-visually-hidden">图片预览</DialogPrimitive.Title>

          <DialogPrimitive.Close asChild>
            <Button
              className="v2ex-image-preview__close"
              variant="ghost"
              icon={<X aria-hidden="true" />}
              aria-label="关闭图片预览"
            />
          </DialogPrimitive.Close>

          {imageCount > 1 && (
            <>
              <Button
                className="v2ex-image-preview__previous"
                variant="ghost"
                icon={<ChevronLeft aria-hidden="true" />}
                aria-label="上一张图片"
                onClick={() => changeImage(-1)}
              />
              <Button
                className="v2ex-image-preview__next"
                variant="ghost"
                icon={<ChevronRight aria-hidden="true" />}
                aria-label="下一张图片"
                onClick={() => changeImage(1)}
              />
            </>
          )}

          <div
            className={mergeClassNames(
              'v2ex-image-preview__stage',
              scale > 1 && 'v2ex-image-preview__stage--zoomed',
              isDragging && 'v2ex-image-preview__stage--dragging'
            )}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            {currentSrc && (
              <img
                ref={imageRef}
                className="v2ex-image-preview__image"
                src={currentSrc}
                alt={`预览图片 ${currentIndex + 1}`}
                draggable={false}
                style={{
                  transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale}) rotate(${rotation}deg)`
                }}
              />
            )}
          </div>

          <div className="v2ex-image-preview__toolbar" aria-label="图片预览工具">
            {imageCount > 1 && (
              <span className="v2ex-image-preview__counter">
                {currentIndex + 1} / {imageCount}
              </span>
            )}
            <Button
              size="small"
              variant="ghost"
              icon={<ZoomOut aria-hidden="true" />}
              disabled={scale <= 0.25}
              aria-label="缩小"
              onClick={() => zoom(-0.25)}
            />
            <span className="v2ex-image-preview__scale">{Math.round(scale * 100)}%</span>
            <Button
              size="small"
              variant="ghost"
              icon={<ZoomIn aria-hidden="true" />}
              disabled={scale >= 4}
              aria-label="放大"
              onClick={() => zoom(0.25)}
            />
            <span className="v2ex-image-preview__separator" />
            <Button
              size="small"
              variant="ghost"
              icon={<RotateCcw aria-hidden="true" />}
              aria-label="向左旋转"
              onClick={() => setRotation(current => current - 90)}
            />
            <Button
              size="small"
              variant="ghost"
              icon={<RotateCw aria-hidden="true" />}
              aria-label="向右旋转"
              onClick={() => setRotation(current => current + 90)}
            />
            <Button
              size="small"
              variant="ghost"
              icon={<Shrink aria-hidden="true" />}
              aria-label="重置图片"
              onClick={resetTransform}
            />
            {toolbarExtra && (
              <>
                <span className="v2ex-image-preview__separator" />
                {toolbarExtra}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
