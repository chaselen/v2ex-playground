import { Download, Smile } from 'lucide-react'
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
  /** 图片表情地址 */
  emoticonSrcList: string[]
}

/** 打开图片预览回调 */
export type OpenImagePreview = (request: ImagePreviewRequest) => void

/** 图片预览状态 */
interface ImagePreviewState {
  /** 未过滤的图片地址 */
  allSrcList: string[]
  /** 可切换的图片地址 */
  srcList: string[]
  /** 当前图片索引 */
  currentIndex: number
  /** 图片表情地址 */
  emoticonSrcList: string[]
  /** 是否过滤图片表情 */
  filterEmoticons: boolean
}

/** 根据过滤状态生成预览序列并尽量保留当前图片位置 */
function resolvePreviewSources(
  allSrcList: string[],
  emoticonSrcList: string[],
  currentSrc: string,
  filterEmoticons: boolean
) {
  const emoticonSrcSet = new Set(emoticonSrcList)
  const srcList = filterEmoticons ? allSrcList.filter(src => !emoticonSrcSet.has(src)) : allSrcList
  let currentIndex = srcList.indexOf(currentSrc)

  if (currentIndex < 0) {
    const originalIndex = allSrcList.indexOf(currentSrc)
    currentIndex = srcList.findIndex(src => allSrcList.indexOf(src) > originalIndex)
    if (currentIndex < 0) {
      currentIndex = 0
    }
  }

  return { currentIndex, srcList }
}

/** 页面图片预览上下文 */
const ImagePreviewContext = createContext<OpenImagePreview>(() => {})

/** 页面图片预览 Provider 属性 */
interface ImagePreviewProviderProps {
  /** 页面内容 */
  children: ReactNode
  /** 是否显示图片表情过滤选项 */
  showEmoticonFilter?: boolean
}

/** 为页面内容提供共享图片预览，并接入扩展侧图片下载 */
export default function ImagePreviewProvider({
  children,
  showEmoticonFilter = false
}: ImagePreviewProviderProps) {
  const [preview, setPreview] = useState<ImagePreviewState | null>(null)
  const openImagePreview = useCallback(({ src, srcList, emoticonSrcList }: ImagePreviewRequest) => {
    const normalizedSrcList = Array.from(
      new Set(srcList.includes(src) ? srcList : [src, ...srcList])
    )
    const normalizedEmoticonSrcList = Array.from(new Set(emoticonSrcList))
    const emoticonSrcSet = new Set(normalizedEmoticonSrcList)
    const filterEmoticons =
      normalizedEmoticonSrcList.length > 0 &&
      !emoticonSrcSet.has(src) &&
      normalizedSrcList.some(imageSrc => !emoticonSrcSet.has(imageSrc))
    const filteredPreview = resolvePreviewSources(
      normalizedSrcList,
      normalizedEmoticonSrcList,
      src,
      filterEmoticons
    )
    setPreview({
      allSrcList: normalizedSrcList,
      srcList: filteredPreview.srcList,
      currentIndex: filteredPreview.currentIndex,
      emoticonSrcList: normalizedEmoticonSrcList,
      filterEmoticons
    })
  }, [])

  const currentSrc = preview?.srcList[preview.currentIndex]
  const emoticonSrcSet = new Set(preview?.emoticonSrcList)
  const canFilterEmoticons = Boolean(
    preview &&
    preview.emoticonSrcList.length > 0 &&
    preview.allSrcList.some(src => !emoticonSrcSet.has(src))
  )

  /** 切换图片表情过滤状态并保留相邻的普通图片 */
  function toggleEmoticonFilter() {
    setPreview(current => {
      if (!current) {
        return current
      }

      const filterEmoticons = !current.filterEmoticons
      const currentSrc = current.srcList[current.currentIndex]
      const { currentIndex, srcList } = resolvePreviewSources(
        current.allSrcList,
        current.emoticonSrcList,
        currentSrc,
        filterEmoticons
      )

      return { ...current, currentIndex, filterEmoticons, srcList }
    })
  }

  return (
    <ImagePreviewContext.Provider value={openImagePreview}>
      {children}
      <ImagePreview
        currentIndex={preview?.currentIndex ?? 0}
        open={Boolean(preview)}
        srcList={preview?.srcList ?? []}
        toolbarStart={
          showEmoticonFilter && canFilterEmoticons ? (
            <Button
              className="v2ex-image-preview__filter"
              size="small"
              variant="ghost"
              icon={<Smile aria-hidden="true" />}
              aria-pressed={preview?.filterEmoticons}
              title="过滤表情"
              onClick={toggleEmoticonFilter}
            >
              过滤表情
            </Button>
          ) : undefined
        }
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
