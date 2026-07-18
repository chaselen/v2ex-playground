import {
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  RotateCw,
  Shrink,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent
} from 'react'
import { Button } from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import type { WebviewCommonRpcCommands } from '@extension/shared/webview'

/** 图片预览 VS Code 通信客户端 */
const vscode = createVsCodeClient<WebviewCommonRpcCommands>()

/** 图片预览请求 */
export interface ImagePreviewRequest {
  /** 当前打开的图片地址 */
  src: string
  /** 可切换的图片地址 */
  srcList: string[]
}

/** 打开图片预览回调 */
export type OpenImagePreview = (request: ImagePreviewRequest) => void

/** 图片预览状态 */
interface ImagePreviewState {
  /** 可切换的图片地址 */
  srcList: string[]
  /** 当前图片索引 */
  currentIndex: number
}

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

const INITIAL_POSITION: ImagePosition = { x: 0, y: 0 }

/** 页面图片预览上下文 */
const ImagePreviewContext = createContext<OpenImagePreview>(() => {})

/** 页面图片预览 Provider 属性 */
interface ImagePreviewProviderProps {
  /** 页面内容 */
  children: ReactNode
}

/** 为页面内容提供共享的 Radix 图片预览 */
export default function ImagePreviewProvider({ children }: ImagePreviewProviderProps) {
  const [preview, setPreview] = useState<ImagePreviewState | null>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState<ImagePosition>(INITIAL_POSITION)
  const [isDragging, setIsDragging] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<ImageDragState | null>(null)
  const openImagePreview = useCallback(({ src, srcList }: ImagePreviewRequest) => {
    const normalizedSrcList = Array.from(
      new Set(srcList.includes(src) ? srcList : [src, ...srcList])
    )
    setPreview({
      srcList: normalizedSrcList,
      currentIndex: normalizedSrcList.indexOf(src)
    })
    setScale(1)
    setRotation(0)
    setPosition(INITIAL_POSITION)
  }, [])

  const currentSrc = preview?.srcList[preview.currentIndex]
  const imageCount = preview?.srcList.length ?? 0

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
    setPreview(current => {
      if (!current || current.srcList.length <= 1) {
        return current
      }
      const currentIndex =
        (current.currentIndex + offset + current.srcList.length) % current.srcList.length
      return { ...current, currentIndex }
    })
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
    <ImagePreviewContext.Provider value={openImagePreview}>
      {children}
      <DialogPrimitive.Root
        open={Boolean(preview)}
        onOpenChange={open => {
          if (!open) {
            setPreview(null)
            resetTransform()
          }
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
              className={`v2ex-image-preview__stage${scale > 1 ? ' is-zoomed' : ''}${isDragging ? ' is-dragging' : ''}`}
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
                  alt={`预览图片 ${preview.currentIndex + 1}`}
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
                  {(preview?.currentIndex ?? 0) + 1} / {imageCount}
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
              <span className="v2ex-image-preview__separator" />
              <Button
                size="small"
                variant="ghost"
                icon={<Download aria-hidden="true" />}
                aria-label="下载图片"
                onClick={() => currentSrc && void vscode.downloadImage(currentSrc)}
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ImagePreviewContext.Provider>
  )
}

/** 获取当前页面的图片预览操作 */
export function useImagePreview() {
  return useContext(ImagePreviewContext)
}
