import { Divider, ImagePreview } from '@douyinfe/semi-ui'
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
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

/** Semi 图片预览菜单运行时参数 */
interface ImagePreviewMenuProps {
  /** 默认菜单项 */
  menuItems?: ReactNode[]
  /** Semi 默认下载回调 */
  onDownload?: () => void
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

  /**
   * 使用扩展侧下载替换 Semi 默认的跨域下载
   * @param menu 预览菜单参数
   */
  function renderPreviewMenu(menu: ImagePreviewMenuProps) {
    const menuItems = [...(menu.menuItems || [])]
    const downloadIndex = menuItems.length - 1
    const downloadItem = menuItems[downloadIndex]
    if (isValidElement(downloadItem)) {
      menuItems[downloadIndex] = cloneElement(
        downloadItem as ReactElement<{ onClick?: () => void }>,
        {
          onClick: () => {
            const imageSrc = preview?.srcList[preview.currentIndex]
            if (imageSrc) {
              void vscode.downloadImage(imageSrc)
            }
          }
        }
      )
    }

    return (
      <>
        {menuItems.slice(0, 3)}
        <Divider key="divider-first" layout="vertical" />
        {menuItems.slice(3, 7)}
        <Divider key="divider-second" layout="vertical" />
        {menuItems.slice(7)}
      </>
    )
  }

  return (
    <ImagePreviewContext.Provider value={openImagePreview}>
      {children}
      <ImagePreview
        src={preview?.srcList ?? []}
        currentIndex={preview?.currentIndex ?? 0}
        visible={Boolean(preview)}
        renderPreviewMenu={renderPreviewMenu}
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
