import { Download } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Button, ImagePreview } from '@/components/ui'
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

/** 页面图片预览上下文 */
const ImagePreviewContext = createContext<OpenImagePreview>(() => {})

/** 页面图片预览 Provider 属性 */
interface ImagePreviewProviderProps {
  /** 页面内容 */
  children: ReactNode
}

/** 为页面内容提供共享图片预览，并接入扩展侧图片下载 */
export default function ImagePreviewProvider({ children }: ImagePreviewProviderProps) {
  const [preview, setPreview] = useState<ImagePreviewState | null>(null)
  const openImagePreview = useCallback(({ src, srcList }: ImagePreviewRequest) => {
    const normalizedSrcList = Array.from(
      new Set(srcList.includes(src) ? srcList : [src, ...srcList])
    )
    setPreview({
      srcList: normalizedSrcList,
      currentIndex: normalizedSrcList.indexOf(src)
    })
  }, [])

  const currentSrc = preview?.srcList[preview.currentIndex]

  return (
    <ImagePreviewContext.Provider value={openImagePreview}>
      {children}
      <ImagePreview
        currentIndex={preview?.currentIndex ?? 0}
        open={Boolean(preview)}
        srcList={preview?.srcList ?? []}
        toolbarExtra={
          currentSrc ? (
            <Button
              size="small"
              variant="ghost"
              icon={<Download aria-hidden="true" />}
              aria-label="下载图片"
              onClick={() => void vscode.downloadImage(currentSrc)}
            />
          ) : undefined
        }
        onCurrentIndexChange={currentIndex => {
          setPreview(current => (current ? { ...current, currentIndex } : current))
        }}
        onOpenChange={open => {
          if (!open) {
            setPreview(null)
          }
        }}
      />
    </ImagePreviewContext.Provider>
  )
}

/** 获取当前页面的图片预览操作 */
export function useImagePreview() {
  return useContext(ImagePreviewContext)
}
