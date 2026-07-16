import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Button, Popover, Spin, TextArea, Toast, Tooltip } from '@douyinfe/semi-ui'
import { IconEmoji, IconImageStroked } from '@douyinfe/semi-icons'
import SimpleBar from 'simplebar-react'
import { proxyImgurImageSrc } from '@/shared/contentEnhancement'
import EnhancedHtmlContent from '@/shared/EnhancedHtmlContent'
import { isApplePlatform } from '@/shared/platform'
import { imageEmoticonLinks, isImageEmoticon } from '@/shared/imageEmoticons'
import { createVsCodeClient } from '@/shared/vscode'
import { emoticonGroups, replaceImageEmoticonTokens } from './emoticons'
import type { TopicPanelRpcCommands } from '@extension/shared/webview'

/** 回复输入组件 VS Code 通信客户端 */
const vscode = createVsCodeClient<TopicPanelRpcCommands>()

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
type ReplyComposerMode = 'edit' | 'preview'

/** 回复框拖放目标 */
interface ReplyComposerDropTarget {
  /** 获取回复表单 */
  getElement(): HTMLFormElement | null
  /** 处理拖放事件 */
  handle(event: DragEvent): void
  /** 清除拖放状态 */
  reset(): void
}

/** 当前页面挂载的回复框拖放目标 */
const replyComposerDropTargets = new Set<ReplyComposerDropTarget>()

/** 全局处理回复框拖放并阻止 VS Code 接管文件 */
function handleReplyComposerDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }

  const eventTarget = event.target
  const activeTarget = Array.from(replyComposerDropTargets).find(target => {
    const element = target.getElement()
    return Boolean(element && eventTarget instanceof Node && element.contains(eventTarget))
  })

  replyComposerDropTargets.forEach(target => {
    if (target !== activeTarget) {
      target.reset()
    }
  })
  activeTarget?.handle(event)
}

/**
 * 注册回复框拖放目标
 * @param target 回复框拖放目标
 */
function registerReplyComposerDropTarget(target: ReplyComposerDropTarget) {
  replyComposerDropTargets.add(target)
  if (replyComposerDropTargets.size === 1) {
    window.addEventListener('dragenter', handleReplyComposerDrop, true)
    window.addEventListener('dragover', handleReplyComposerDrop, true)
    window.addEventListener('drop', handleReplyComposerDrop, true)
  }

  return () => {
    replyComposerDropTargets.delete(target)
    if (!replyComposerDropTargets.size) {
      window.removeEventListener('dragenter', handleReplyComposerDrop, true)
      window.removeEventListener('dragover', handleReplyComposerDrop, true)
      window.removeEventListener('drop', handleReplyComposerDrop, true)
    }
  }
}

/** 回复输入框暴露给页面层的操作 */
export interface ReplyComposerHandle {
  /** 设置回复内容并聚焦 */
  setContent(content: string): void
}

/** 回复输入组件属性 */
interface ReplyComposerProps {
  /** 是否显示图片 */
  showImages: boolean
  /** 重置编辑状态的标识 */
  resetKey?: string | number
  /** 提交已处理图片表情的回复内容 */
  onSubmit(content: string): Promise<void>
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
  { showImages, resetKey, onSubmit: submitContent },
  ref
) {
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<ReplyComposerMode>('edit')
  const [previewing, setPreviewing] = useState(false)
  const [posting, setPosting] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSource, setPreviewSource] = useState('')
  const composerRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const postingRef = useRef(posting)
  const imgurWarningShownRef = useRef(false)
  const uploadAndInsertImagesRef = useRef<(files: FileList | File[]) => void>(() => undefined)
  const generationRef = useRef(0)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [draggingImage, setDraggingImage] = useState(false)
  const [emoticonPanelVisible, setEmoticonPanelVisible] = useState(false)
  const replyShortcutLabel = isApplePlatform() ? '⌘+Enter' : 'Ctrl+Enter'
  /** 是否禁用表情选择 */
  const emoticonDisabled = posting || uploadingImage

  postingRef.current = posting

  useImperativeHandle(ref, () => ({
    setContent(content: string) {
      generationRef.current++
      setValue(content)
      setPreviewing(false)
      setPosting(false)
      setPreviewHtml('')
      setMode('edit')
      requestAnimationFrame(() => getTextarea()?.focus())
    }
  }))

  useEffect(() => {
    generationRef.current++
    reset()
  }, [resetKey])

  /** 重置编辑状态 */
  function reset() {
    setValue('')
    setMode('edit')
    setPreviewing(false)
    setPosting(false)
    setPreviewHtml('')
    setPreviewSource('')
  }

  /** 更新回复内容 */
  function updateContent(nextValue: string) {
    if (nextValue !== value) {
      generationRef.current++
      setPreviewing(false)
    }
    setValue(nextValue)
    if (nextValue !== previewSource) {
      setPreviewHtml('')
    }
  }

  /** 生成回复预览 */
  async function previewReply() {
    if (!value.trim()) {
      Toast.warning('回复内容不能为空')
      setMode('edit')
      requestAnimationFrame(() => getTextarea()?.focus())
      return
    }

    if (previewHtml && previewSource === value) {
      setMode('preview')
      return
    }

    const generation = generationRef.current
    setMode('preview')
    setPreviewing(true)
    try {
      const html = await vscode.previewReply({
        content: replaceImageEmoticonTokens(value)
      })
      if (generation === generationRef.current) {
        setPreviewHtml(html)
        setPreviewSource(value)
      }
    } catch (err) {
      if (generation === generationRef.current) {
        Toast.error((err as Error).message || '预览失败')
        setMode('edit')
      }
    } finally {
      if (generation === generationRef.current) {
        setPreviewing(false)
      }
    }
  }

  /** 提交回复 */
  async function submitReply() {
    const normalizedContent = replaceImageEmoticonTokens(value)
    if (!normalizedContent) {
      Toast.warning('回复内容不能为空')
      requestAnimationFrame(() => getTextarea()?.focus())
      return
    }

    const generation = generationRef.current
    setPosting(true)
    try {
      await submitContent(normalizedContent)
      if (generation === generationRef.current) {
        reset()
      }
    } catch (err) {
      if (generation === generationRef.current) {
        Toast.error((err as Error).message || '回复失败')
      }
    } finally {
      if (generation === generationRef.current) {
        setPosting(false)
      }
    }
  }

  /** 上传回复图片 */
  async function uploadImage(file: File) {
    return vscode.uploadImage({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64: await readFileAsBase64(file)
    })
  }

  /** 检测 Imgur 连通性 */
  function checkImgurConnectivity(target: 'image' | 'upload', refresh = false) {
    return vscode.checkImgurConnectivity({ target, refresh })
  }

  useEffect(() => {
    /**
     * 在当前回复框内处理图片上传
     * @param event 拖拽事件
     */
    function handleDrop(event: DragEvent) {
      if (postingRef.current) {
        setDraggingImage(false)
        return
      }

      if (event.type === 'drop') {
        setDraggingImage(false)

        if (!event.dataTransfer?.files.length) {
          return
        }

        uploadAndInsertImagesRef.current(event.dataTransfer.files)
        return
      }

      setDraggingImage(Boolean(event.dataTransfer && hasImageTransfer(event.dataTransfer)))
    }

    return registerReplyComposerDropTarget({
      getElement: () => composerRef.current,
      handle: handleDrop,
      reset: () => setDraggingImage(false)
    })
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
      if (await checkImgurConnectivity('upload', refresh)) {
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
      if ((await checkImgurConnectivity('image', false)) || imgurWarningShownRef.current) {
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

    updateContent(nextValue)
    setMode('edit')

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
      const links = await Promise.all(imageFiles.map(file => uploadImage(file)))
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
    void submitReply()
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
          void submitReply()
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
          onClick={() => setMode('edit')}
        >
          编辑
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preview'}
          className={mode === 'preview' ? 'is-active' : undefined}
          disabled={posting}
          onClick={() => void previewReply()}
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
            onChange={nextValue => updateContent(String(nextValue || ''))}
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
            <EnhancedHtmlContent
              className="topic-content reply-preview-content"
              html={previewHtml}
              showImages={showImages}
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

/**
 * 读取文件为 base64 内容
 * @param file 文件对象
 */
function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}
