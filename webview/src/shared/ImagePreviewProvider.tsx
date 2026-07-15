import { ImagePreview } from '@douyinfe/semi-ui'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

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

/**
 * 为页面内容提供共享的 Semi 图片预览
 */
export default function ImagePreviewProvider({ children }: ImagePreviewProviderProps) {
  const [preview, setPreview] = useState<ImagePreviewState | null>(null)
  const openImagePreview = useCallback(({ src, srcList }: ImagePreviewRequest) => {
    const normalizedSrcList = srcList.includes(src) ? srcList : [src, ...srcList]
    setPreview({
      srcList: normalizedSrcList,
      currentIndex: normalizedSrcList.indexOf(src)
    })
  }, [])

  return (
    <ImagePreviewContext.Provider value={openImagePreview}>
      {children}
      <ImagePreview
        src={preview?.srcList ?? []}
        currentIndex={preview?.currentIndex ?? 0}
        visible={Boolean(preview)}
        disableDownload
        onChange={currentIndex => {
          setPreview(current => (current ? { ...current, currentIndex } : current))
        }}
        onVisibleChange={visible => {
          if (!visible) {
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
