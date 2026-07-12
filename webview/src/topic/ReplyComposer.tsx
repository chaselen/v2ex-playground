import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Button, Popover, Spin, TextArea, Toast, Tooltip } from '@douyinfe/semi-ui'
import { IconEmoji, IconImageStroked } from '@douyinfe/semi-icons'
import SimpleBar from 'simplebar-react'
import { normalizeHtml, proxyImgurImageSrc } from '@/shared/contentEnhancement'
import { imageEmoticonLinks, isImageEmoticon } from '@/shared/imageEmoticons'
import { emoticonGroups } from './emoticons'

/** Imgur 支持上传的图片 MIME 类型 */
const imgurImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/apng',
  'image/tiff'
])

/** Imgur 支持上传的图片扩展名 */
const imgurImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.apng', '.tif', '.tiff'] as const

/** 文件选择器使用的 Imgur 图片类型过滤条件 */
const imgurImageAccept = [...imgurImageMimeTypes, ...imgurImageExtensions].join(',')

/** Imgur 非动画图片大小上限 */
const imgurStillImageMaxSize = 50 * 1024 * 1024

/** Imgur 动画图片大小上限 */
const imgurAnimatedImageMaxSize = 200 * 1024 * 1024

/** 回复编辑模式 */
export type ReplyComposerMode = 'edit' | 'preview'

/** 回复输入框暴露给页面层的操作 */
export interface ReplyComposerHandle {
  /** 聚焦文本输入框 */
  focus(): void
}

/** 回复输入组件属性 */
interface ReplyComposerProps {
  /** 回复内容 */
  value: string
  /** 当前编辑模式 */
  mode: ReplyComposerMode
  /** 回复预览 HTML */
  previewHtml: string
  /** 是否正在生成预览 */
  previewing: boolean
  /** 是否正在提交回复 */
  posting: boolean
  /** 更新回复内容 */
  onChange(value: string): void
  /** 切换编辑模式 */
  onModeChange(mode: ReplyComposerMode): void
  /** 预览回复内容 */
  onPreview(): void
  /** 提交回复 */
  onSubmit(): void
  /** 上传图片 */
  onUploadImage(file: File): Promise<string>
  /** 检测 Imgur 连通性 */
  onCheckImgurConnectivity(target: 'image' | 'upload', refresh?: boolean): Promise<boolean>
}

/**
 * 判断是否为 Apple 平台
 */
function isApplePlatform() {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}

/**
 * 判断文件是否为 Imgur 支持的图片类型
 * @param file 待判断文件
 */
function isImgurImageFile(file: File) {
  if (imgurImageMimeTypes.has(file.type.toLowerCase())) {
    return true
  }

  const filename = file.name.toLowerCase()
  return imgurImageExtensions.some(extension => filename.endsWith(extension))
}

/**
 * 获取 Imgur 对图片文件的大小上限
 * @param file 图片文件
 */
function getImgurImageMaxSize(file: File) {
  const mimeType = file.type.toLowerCase()
  const filename = file.name.toLowerCase()
  const isAnimatedImage =
    mimeType === 'image/gif' ||
    mimeType === 'image/apng' ||
    filename.endsWith('.gif') ||
    filename.endsWith('.apng')

  return isAnimatedImage ? imgurAnimatedImageMaxSize : imgurStillImageMaxSize
}

/**
 * 话题回复输入组件
 */
const ReplyComposer = forwardRef<ReplyComposerHandle, ReplyComposerProps>(function ReplyComposer(
  {
    value,
    mode,
    previewHtml,
    previewing,
    posting,
    onChange,
    onModeChange,
    onPreview,
    onSubmit,
    onUploadImage,
    onCheckImgurConnectivity
  },
  ref
) {
  const composerRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const postingRef = useRef(posting)
  const imgurWarningShownRef = useRef(false)
  const uploadAndInsertImagesRef = useRef<(files: FileList | File[]) => void>(() => undefined)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [draggingImage, setDraggingImage] = useState(false)
  const [emoticonPanelVisible, setEmoticonPanelVisible] = useState(false)
  const replyShortcutLabel = isApplePlatform() ? '⌘+Enter' : 'Ctrl+Enter'
  /** 是否禁用表情选择 */
  const emoticonDisabled = posting || uploadingImage

  postingRef.current = posting

  useImperativeHandle(ref, () => ({
    focus() {
      getTextarea()?.focus()
    }
  }))

  useEffect(() => {
    /**
     * 阻止 VS Code 接管 Webview 内拖放，并在回复框内处理图片上传
     * @param event 拖拽事件
     */
    function preventWebviewDrop(event: DragEvent) {
      const composer = composerRef.current
      const target = event.target
      const isComposerDrop = Boolean(
        composer && target instanceof Node && composer.contains(target)
      )

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      if (postingRef.current) {
        setDraggingImage(false)
        return
      }

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }

      if (event.type === 'drop') {
        setDraggingImage(false)

        if (!isComposerDrop || !event.dataTransfer?.files.length) {
          return
        }

        uploadAndInsertImagesRef.current(event.dataTransfer.files)
        return
      }

      setDraggingImage(
        Boolean(isComposerDrop && event.dataTransfer && hasImageTransfer(event.dataTransfer))
      )
    }

    document.addEventListener('dragenter', preventWebviewDrop, true)
    document.addEventListener('dragover', preventWebviewDrop, true)
    document.addEventListener('drop', preventWebviewDrop, true)
    window.addEventListener('dragenter', preventWebviewDrop, true)
    window.addEventListener('dragover', preventWebviewDrop, true)
    window.addEventListener('drop', preventWebviewDrop, true)

    return () => {
      document.removeEventListener('dragenter', preventWebviewDrop, true)
      document.removeEventListener('dragover', preventWebviewDrop, true)
      document.removeEventListener('drop', preventWebviewDrop, true)
      window.removeEventListener('dragenter', preventWebviewDrop, true)
      window.removeEventListener('dragover', preventWebviewDrop, true)
      window.removeEventListener('drop', preventWebviewDrop, true)
    }
  }, [])

  useEffect(() => {
    if (posting) {
      setDraggingImage(false)
    }

    if (emoticonDisabled) {
      setEmoticonPanelVisible(false)
    }
  }, [emoticonDisabled, posting])

  /**
   * 获取实际文本框节点
   */
  function getTextarea() {
    return composerRef.current?.querySelector<HTMLTextAreaElement>('textarea')
  }

  /**
   * 打开图片选择器
   */
  function selectImage() {
    fileInputRef.current?.click()
  }

  /**
   * 确认 Imgur 可用并给出与当前操作对应的提示
   * @param refresh 是否强制重新检测
   */
  async function ensureImgurAvailable(refresh: boolean) {
    try {
      if (await onCheckImgurConnectivity('upload', refresh)) {
        return true
      }
    } catch {
      // 检测异常按不可用处理，避免继续发起注定失败的上传
    }

    Toast.warning('当前无法连接 Imgur，图片上传功能不可用，请检查网络或代理设置')
    return false
  }

  /** 打开表情面板时按需检查图片表情服务 */
  async function checkImgurForEmoticons() {
    try {
      if ((await onCheckImgurConnectivity('image', false)) || imgurWarningShownRef.current) {
        return
      }
    } catch {
      if (imgurWarningShownRef.current) {
        return
      }
    }

    imgurWarningShownRef.current = true
    Toast.warning('Imgur 当前不可用，图片表情无法显示，文字表情仍可使用')
  }

  /**
   * 提取图片文件
   * @param fileList 文件列表
   */
  function getImageFiles(fileList: FileList | File[]) {
    return Array.from(fileList).filter(isImgurImageFile)
  }

  /**
   * 判断拖拽数据是否包含图片
   * @param dataTransfer 拖拽数据
   */
  function hasImageTransfer(dataTransfer: DataTransfer) {
    return Array.from(dataTransfer.items).some(
      item => item.kind === 'file' && imgurImageMimeTypes.has(item.type.toLowerCase())
    )
  }

  /**
   * 插入上传后的图片链接
   * @param links 图片链接列表
   */
  function insertImageLinks(links: string[]) {
    insertText(links.join(' '), true)
  }

  /**
   * 插入表情文本
   * @param text 表情文本
   */
  function insertEmoticon(text: string) {
    if (emoticonDisabled) {
      return
    }

    insertText(text)
  }

  /**
   * 在光标处插入文本
   * @param text 插入文本
   * @param padded 是否补充前后空格
   */
  function insertText(text: string, padded = false) {
    const textarea = getTextarea()
    const selectionStart = textarea?.selectionStart ?? value.length
    const selectionEnd = textarea?.selectionEnd ?? selectionStart
    const before = value.slice(0, selectionStart)
    const after = value.slice(selectionEnd)
    const prefix = padded && before && !/\s$/.test(before) ? ' ' : ''
    const suffix = padded && (!after || !/^\s/.test(after)) ? ' ' : ''
    const insertedText = `${prefix}${text}${suffix}`
    const nextValue = `${before}${insertedText}${after}`
    const cursor = before.length + insertedText.length

    onChange(nextValue)
    onModeChange('edit')

    requestAnimationFrame(() => {
      const nextTextarea = getTextarea()

      nextTextarea?.focus()
      nextTextarea?.setSelectionRange(cursor, cursor)
    })
  }

  /**
   * 渲染图片表情
   * @param emoticon 图片表情文本
   */
  function renderImageEmoticon(emoticon: keyof typeof imageEmoticonLinks) {
    const originalSrc = imageEmoticonLinks[emoticon]

    return (
      <img
        src={proxyImgurImageSrc(originalSrc)}
        data-preview-src={originalSrc}
        alt={emoticon}
        loading="lazy"
      />
    )
  }

  /**
   * 渲染表情面板
   */
  function renderEmoticonPanel() {
    return (
      <SimpleBar className="reply-emoticon-panel" autoHide={false}>
        <div className="reply-emoticon-content">
          {emoticonGroups.map(group => (
            <section key={group.title} className="reply-emoticon-section">
              <h3>{group.title}</h3>
              <div className="reply-emoticon-grid">
                {group.list.map(emoticon => (
                  <button
                    key={emoticon}
                    type="button"
                    className="reply-emoticon-option"
                    title={emoticon}
                    disabled={emoticonDisabled}
                    onClick={() => insertEmoticon(emoticon)}
                  >
                    {isImageEmoticon(emoticon) ? (
                      renderImageEmoticon(emoticon)
                    ) : (
                      <span>{emoticon}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SimpleBar>
    )
  }

  /**
   * 上传并插入图片文件
   * @param files 文件列表
   */
  async function uploadAndInsertImages(files: FileList | File[]) {
    if (postingRef.current) {
      return
    }

    const imageFiles = getImageFiles(files)

    if (!imageFiles.length) {
      Toast.warning('请选择 Imgur 支持的图片文件（JPEG、PNG、GIF、APNG、TIFF）')
      return
    }

    const oversizedFile = imageFiles.find(file => file.size > getImgurImageMaxSize(file))

    if (oversizedFile) {
      const maxSizeInMb = getImgurImageMaxSize(oversizedFile) / 1024 / 1024
      Toast.warning(`${oversizedFile.name} 超过 Imgur 的 ${maxSizeInMb} MB 大小限制`)
      return
    }

    if (!(await ensureImgurAvailable(true))) {
      return
    }

    setUploadingImage(true)
    try {
      const links = await Promise.all(imageFiles.map(file => onUploadImage(file)))
      insertImageLinks(links)
      Toast.success('图片上传成功')
    } catch (err) {
      const message = (err as Error).message
      Toast.error(
        message && message !== '上传失败'
          ? `图片上传失败：${message}；请检查 Imgur 连通性或代理设置`
          : '图片上传失败，请检查 Imgur 连通性或代理设置'
      )
    } finally {
      setUploadingImage(false)
    }
  }

  uploadAndInsertImagesRef.current = uploadAndInsertImages

  /**
   * 处理文件选择
   * @param event 文件输入事件
   */
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files

    if (files) {
      uploadAndInsertImages(files)
    }

    event.currentTarget.value = ''
  }

  /**
   * 处理图片粘贴
   * @param event 粘贴事件
   */
  function handlePaste(event: React.ClipboardEvent<HTMLFormElement>) {
    if (posting) {
      return
    }

    const files = getImageFiles(
      Array.from(event.clipboardData.items)
        .map(item => item.getAsFile())
        .filter(Boolean) as File[]
    )

    if (!files.length) {
      return
    }

    event.preventDefault()
    uploadAndInsertImages(files)
  }

  /**
   * 处理回复快捷键
   * @param event 键盘事件
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (posting || event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) {
      return
    }

    event.preventDefault()
    onSubmit()
  }

  return (
    <form
      ref={composerRef}
      className="post-reply"
      aria-busy={posting}
      aria-disabled={posting}
      inert={posting}
      onSubmit={event => {
        event.preventDefault()
        if (!posting) {
          onSubmit()
        }
      }}
      onPaste={handlePaste}
      onDragLeave={() => setDraggingImage(false)}
      onKeyDown={handleKeyDown}
    >
      <div className="reply-composer-tabs" role="tablist" aria-label="回复编辑模式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'edit'}
          className={mode === 'edit' ? 'is-active' : undefined}
          disabled={posting}
          onClick={() => onModeChange('edit')}
        >
          编辑
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preview'}
          className={mode === 'preview' ? 'is-active' : undefined}
          disabled={posting}
          onClick={onPreview}
        >
          预览
        </button>
      </div>

      {mode === 'edit' ? (
        <div className={`reply-editor-frame ${draggingImage ? 'is-dragging' : ''}`}>
          <TextArea
            value={value}
            maxCount={10000}
            autosize={{ minRows: 5, maxRows: 12 }}
            placeholder="请尽量让自己的回复能够对别人有帮助"
            showClear
            disabled={posting || uploadingImage}
            onChange={nextValue => onChange(String(nextValue || ''))}
          />
          <div className="reply-upload-bar">
            <button
              type="button"
              className="reply-upload-link"
              disabled={posting || uploadingImage}
              onClick={selectImage}
            >
              {uploadingImage ? '正在上传图片...' : '选择、粘贴、拖放上传图片'}
            </button>
            {uploadingImage && <Spin size="small" />}
          </div>
        </div>
      ) : (
        <div className="reply-preview-panel">
          {previewing ? (
            <Spin />
          ) : previewHtml ? (
            <div
              className="topic-content reply-preview-content"
              dangerouslySetInnerHTML={{ __html: normalizeHtml(previewHtml) }}
            />
          ) : (
            <p className="muted">暂无预览内容</p>
          )}
        </div>
      )}

      <div className="reply-submit-row">
        <Popover
          trigger="click"
          position="topRight"
          showArrow
          visible={!emoticonDisabled && emoticonPanelVisible}
          content={renderEmoticonPanel()}
          contentClassName="reply-emoticon-popover"
          onVisibleChange={visible => {
            if (!emoticonDisabled) {
              setEmoticonPanelVisible(visible)
              if (visible) {
                void checkImgurForEmoticons()
              }
            }
          }}
        >
          <span className="reply-extra-popover-trigger">
            <Tooltip content="插入表情">
              <Button
                aria-label="插入表情"
                className="reply-extra-button"
                icon={<IconEmoji />}
                size="small"
                theme="light"
                type="tertiary"
                disabled={emoticonDisabled}
              />
            </Tooltip>
          </span>
        </Popover>
        <Tooltip content="上传图片">
          <Button
            aria-label="上传图片"
            className="reply-extra-button"
            icon={<IconImageStroked />}
            size="small"
            theme="light"
            type="tertiary"
            disabled={posting || uploadingImage}
            loading={uploadingImage}
            onClick={selectImage}
          />
        </Tooltip>
        <Button
          className="submit"
          theme="solid"
          type="primary"
          htmlType="submit"
          loading={posting}
          disabled={posting || uploadingImage}
        >
          {posting ? (
            '回复中'
          ) : (
            <>
              回复
              <kbd>{replyShortcutLabel}</kbd>
            </>
          )}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={imgurImageAccept}
        multiple
        hidden
        disabled={posting || uploadingImage}
        onChange={handleFileChange}
      />
    </form>
  )
})

export default ReplyComposer
