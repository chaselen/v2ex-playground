import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, Heart, Inbox } from 'lucide-react'
import QRCode from 'qrcode'
import SimpleBar from 'simplebar-react'
import EnhancedHtmlContent from '@/components/EnhancedHtmlContent'
import UserBadge from '@/components/UserBadge'
import {
  Badge,
  Button,
  Dialog,
  Empty,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  Toast
} from '@/components/ui'
import { enhanceCodeBlocks, normalizeHtml } from '@/core/contentEnhancement'
import { calculateShareImagePixelRatio, isOriginalRemoteShareImage } from '@/core/shareImageCapture'
import { buildReplyTree, type ReplyViewMode, type TopicReplyNode } from './replyTree'
import styles from './TopicShareDialog.module.scss'
import v2exIcon from '../../../../resources/favicon.png'
import type { TopicDetail, TopicReply } from '@extension/v2ex/types'

/** 远程图片无法嵌入时使用的透明占位图 */
const TRANSPARENT_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

/** 单次 RPC 加载的分享图片数量 */
const SHARE_IMAGE_BATCH_SIZE = 50

/** 单批内联的分享图片数量 */
const SHARE_IMAGE_INLINE_BATCH_SIZE = 10

/** 分享图片等待加载的最长时间 */
const SHARE_IMAGE_LOAD_TIMEOUT_MS = 5000

/** 分享图片加载选项 */
interface LoadShareImagesOptions {
  /** 返回格式 */
  format?: 'resourceUri' | 'dataUrl'
}

/** 话题分享弹窗属性 */
interface TopicShareDialogProps {
  /** 是否打开 */
  open: boolean
  /** 话题详情 */
  topic: TopicDetail
  /** 主题页当前回复展示模式 */
  replyViewMode: ReplyViewMode
  /** 加载第一页回复 */
  loadFirstReplyPage: () => Promise<TopicDetail>
  /** 加载分享图使用的本地资源 URI 或 data URL */
  loadImages: (
    imageSources: string[],
    options?: LoadShareImagesOptions
  ) => Promise<Record<string, string>>
  /** 弹窗状态变化 */
  onOpenChange: (open: boolean) => void
  /** 复制话题链接 */
  onCopyLink: () => Promise<void>
  /** 保存 PNG 图片 */
  onSave: (base64: string) => void
}

/** 话题分享图弹窗 */
export default function TopicShareDialog({
  loadFirstReplyPage,
  loadImages,
  onCopyLink,
  onOpenChange,
  onSave,
  open,
  replyViewMode,
  topic
}: TopicShareDialogProps) {
  const cardRef = useRef<HTMLElement>(null)
  const [showQrCode, setShowQrCode] = useState(true)
  const [showAppends, setShowAppends] = useState(true)
  const [showReplies, setShowReplies] = useState(false)
  const [shareReplyViewMode, setShareReplyViewMode] = useState<ReplyViewMode>(replyViewMode)
  const [firstPageReplies, setFirstPageReplies] = useState<TopicReply[]>()
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [embeddedImages, setEmbeddedImages] = useState<Record<string, string>>({})
  const [qrCode, setQrCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyingLink, setCopyingLink] = useState(false)
  const generating = saving || copying
  const topicLink = `https://www.v2ex.com/t/${topic.id}`
  const hasTopicContent = Boolean(topic.content)
  const shareReplies = useMemo(() => {
    if (!firstPageReplies) {
      return []
    }
    return shareReplyViewMode === 'nested'
      ? buildReplyTree(firstPageReplies)
      : firstPageReplies.map<TopicReplyNode>(reply => ({ ...reply, children: [] }))
  }, [firstPageReplies, shareReplyViewMode])
  const publishedDate = useMemo(
    () => (topic.publishedAt || topic.displayTime).split(' ')[0],
    [topic.displayTime, topic.publishedAt]
  )

  useLayoutEffect(() => {
    const card = cardRef.current
    if (card) {
      void enhanceCodeBlocks(card)
    }
  })

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(topicLink, {
      width: 112,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#17251fff', light: '#f6fbf7ff' }
    })
      .then(dataUrl => {
        if (active) {
          setQrCode(dataUrl)
        }
      })
      .catch(() => {
        if (active) {
          setQrCode('')
        }
      })
    return () => {
      active = false
    }
  }, [topicLink])

  useEffect(() => {
    if (open) {
      void embedShareImages().catch(() => undefined)
    }
  }, [firstPageReplies, open, showAppends, showReplies, topic])

  useEffect(() => {
    if (open) {
      setShareReplyViewMode(replyViewMode)
    }
  }, [open, replyViewMode])

  /** 生成当前分享卡片 PNG */
  async function createImage() {
    const card = cardRef.current
    if (!card) {
      throw new Error('分享图尚未准备完成')
    }

    const [, captureImages] = await Promise.all([document.fonts.ready, embedShareImages()])
    await enhanceCodeBlocks(card)
    const restoreImages = await inlineShareImagesForCapture(card, captureImages)
    try {
      const pixelRatio = calculateShareImagePixelRatio(card.scrollHeight)
      const { snapdom } = await import('@zumer/snapdom')
      return await snapdom.toBlob(card, {
        type: 'png',
        backgroundColor: getComputedStyle(card).backgroundColor,
        compress: false,
        dpr: pixelRatio,
        embedFonts: false,
        fallbackURL: TRANSPARENT_IMAGE,
        fast: true,
        resolvePicturePlaceholders: false
      })
    } finally {
      // data URL 只服务于本次截图，完成后恢复轻量资源 URI
      restoreImages()
    }
  }

  /** 将当前分享内容中的远程图片转换为可嵌入图片 */
  async function embedShareImages() {
    const imageSources = Array.from(
      new Set(
        [
          topic.authorAvatar,
          ...getHtmlImageSources(topic.content),
          ...(showAppends
            ? topic.appends.flatMap(append => getHtmlImageSources(append.content))
            : []),
          ...(showReplies && firstPageReplies
            ? firstPageReplies.flatMap(reply => [
                reply.userAvatar,
                ...getHtmlImageSources(reply.content)
              ])
            : [])
        ].filter(imageSrc => imageSrc && !embeddedImages[imageSrc])
      )
    )
    if (!imageSources.length) {
      return embeddedImages
    }

    const loadedImages: Record<string, string> = {}
    for (let index = 0; index < imageSources.length; index += SHARE_IMAGE_BATCH_SIZE) {
      Object.assign(
        loadedImages,
        await loadImages(imageSources.slice(index, index + SHARE_IMAGE_BATCH_SIZE))
      )
    }
    setEmbeddedImages(current => ({ ...current, ...loadedImages }))
    await waitForAnimationFrame()
    return { ...embeddedImages, ...loadedImages }
  }

  /** 截图前临时内联分享图片并返回恢复函数 */
  async function inlineShareImagesForCapture(
    card: HTMLElement,
    captureImages: Record<string, string>
  ) {
    // 图片在预览中可见不代表 SnapDOM 能从 Webview Origin 再次读取其地址
    const images = Array.from(card.querySelectorAll<HTMLImageElement>('img[data-share-image-src]'))
    const imageEntries = Array.from(
      new Map(
        images.map(image => {
          const originalSrc = image.dataset.shareImageSrc || ''
          return [originalSrc, captureImages[originalSrc] || image.getAttribute('src') || '']
        })
      ).entries()
    ).filter(([originalSrc, displaySrc]) => originalSrc && displaySrc)
    const inlineImages: Record<string, string> = {}

    // 优先在 Webview 内读取已缓存的资源 URI，避免默认通过 RPC 传输 base64
    for (let index = 0; index < imageEntries.length; index += SHARE_IMAGE_INLINE_BATCH_SIZE) {
      const entries = imageEntries.slice(index, index + SHARE_IMAGE_INLINE_BATCH_SIZE)
      const results = await Promise.allSettled(
        entries.map(async ([originalSrc, displaySrc]) => {
          // 原图仍为 HTTP(S) 时禁止从 Webview 请求，避免即使随后回退仍产生 CORS 错误
          if (isOriginalRemoteShareImage(originalSrc, displaySrc, document.baseURI)) {
            return undefined
          }
          const dataUrl = displaySrc.startsWith('data:')
            ? displaySrc
            : await fetchImageDataUrl(displaySrc)
          return [originalSrc, dataUrl] as const
        })
      )
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          inlineImages[result.value[0]] = result.value[1]
        }
      })
    }

    const fallbackSources = imageEntries
      .map(([originalSrc]) => originalSrc)
      .filter(originalSrc => !inlineImages[originalSrc])
    // 部分宿主不允许 fetch Webview 资源 URI，此时由扩展侧读取同一缓存文件
    for (let index = 0; index < fallbackSources.length; index += SHARE_IMAGE_BATCH_SIZE) {
      Object.assign(
        inlineImages,
        await loadImages(fallbackSources.slice(index, index + SHARE_IMAGE_BATCH_SIZE), {
          format: 'dataUrl'
        })
      )
    }

    // 保存当前属性，截图完成后不能让临时 data URL 污染 React 管理的预览 DOM
    const previousSources = Array.from(
      card.querySelectorAll<HTMLImageElement | HTMLSourceElement>('img, source')
    ).map(element => ({
      element,
      src: element.getAttribute('src'),
      srcset: element.getAttribute('srcset')
    }))
    images.forEach(image => {
      image.src = inlineImages[image.dataset.shareImageSrc || ''] || TRANSPARENT_IMAGE
    })
    // picture/source 可能覆盖 img.src，必须一并移除响应式远程候选地址
    card.querySelectorAll<HTMLImageElement>('img').forEach(image => {
      image.removeAttribute('srcset')
      if (/^https?:/i.test(image.getAttribute('src') || '')) {
        image.src = TRANSPARENT_IMAGE
      }
    })
    card.querySelectorAll<HTMLSourceElement>('source').forEach(source => {
      source.removeAttribute('srcset')
    })
    // 等待 data URL 解码完成，避免 SnapDOM 克隆到尚未就绪的图片节点
    await waitForShareImages(card)

    return () => {
      previousSources.forEach(({ element, src, srcset }) => {
        restoreAttribute(element, 'src', src)
        restoreAttribute(element, 'srcset', srcset)
      })
    }
  }

  /** 切换第一页回复展示 */
  async function toggleReplies(checked: boolean) {
    setShowReplies(checked)
    if (!checked || firstPageReplies) {
      return
    }

    setLoadingReplies(true)
    try {
      const firstPageTopic = await loadFirstReplyPage()
      setFirstPageReplies(firstPageTopic.replies)
    } catch (err) {
      setShowReplies(false)
      Toast.error((err as Error).message || '第一页回复加载失败')
    } finally {
      setLoadingReplies(false)
    }
  }

  /** 保存分享图 */
  async function saveImage() {
    setSaving(true)
    try {
      const blob = await createImage()
      onSave(await blobToBase64(blob))
    } catch (err) {
      Toast.error((err as Error).message || '分享图生成失败')
    } finally {
      setSaving(false)
    }
  }

  /** 复制话题链接 */
  async function copyLink() {
    setCopyingLink(true)
    try {
      await onCopyLink()
      Toast.success('话题链接已复制')
    } catch (err) {
      Toast.error((err as Error).message || '话题链接复制失败')
    } finally {
      setCopyingLink(false)
    }
  }

  /** 复制分享图 */
  async function copyImage() {
    setCopying(true)
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('当前宿主不支持复制图片，请使用保存图片')
      }
      const blob = await createImage()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      Toast.success('分享图已复制')
    } catch (err) {
      Toast.error((err as Error).message || '复制分享图失败')
    } finally {
      setCopying(false)
    }
  }

  /** 渲染单条分享回复及其子回复 */
  function renderShareReply(reply: TopicReplyNode) {
    // 页面未提供数量时仍需体现当前用户已发送的感谢
    const thankCount = Math.max(reply.thanks, reply.thanked ? 1 : 0)
    return (
      <article className={styles.cardReply} key={reply.replyId}>
        <header className="reply-meta">
          <span className={styles.cardReplyAuthor}>
            {reply.userAvatar && (
              <img
                src={embeddedImages[reply.userAvatar] || reply.userAvatar}
                data-share-image-src={reply.userAvatar}
                alt=""
              />
            )}
            <strong>{reply.userName}</strong>
            <UserBadge mod={reply.isMod} op={reply.isOp} pro={reply.isPro} />
            <span className="time" title={reply.repliedAt || reply.time}>
              {reply.time}
            </span>
            {thankCount > 0 && (
              <span className={`thanks ${styles.cardReplyThanks}`} title={`${thankCount} 人感谢`}>
                <Heart aria-hidden="true" />
                {thankCount}
              </span>
            )}
          </span>
          <div className="reply-actions">
            <span className="floor">{reply.floor}</span>
          </div>
        </header>
        <EnhancedHtmlContent
          className={`topic-content reply-content ${styles.cardContent}`}
          html={embedHtmlImages(reply.content, embeddedImages)}
        />
        {shareReplyViewMode === 'nested' && reply.children.length > 0 && (
          <div className={styles.cardReplyChildren}>
            {reply.children.map(child => renderShareReply(child))}
          </div>
        )}
      </article>
    )
  }

  return (
    <Dialog
      className={styles.dialog}
      open={open}
      title={
        <span className={styles.dialogTitle}>
          <span>分享话题</span>
          <Badge count="BETA" variant="danger" />
        </span>
      }
      onOpenChange={onOpenChange}
    >
      <div className={styles.layout}>
        <SimpleBar
          className={styles.preview}
          aria-label="分享图预览"
          autoHide={false}
          role="region"
        >
          <div className={styles.previewContent}>
            <article className={styles.card} ref={cardRef}>
              <header className={styles.cardHeader}>
                <div className={styles.cardBrand}>
                  <img src={v2exIcon} alt="" />
                  <span>V2EX</span>
                </div>
                <h1>{topic.title}</h1>
                <div className={styles.cardMeta}>
                  <span className={styles.cardAuthor}>
                    {topic.authorAvatar && (
                      <img
                        src={embeddedImages[topic.authorAvatar] || topic.authorAvatar}
                        data-share-image-src={topic.authorAvatar}
                        alt=""
                      />
                    )}
                    <strong>{topic.authorName}</strong>
                  </span>
                  <span>{publishedDate}</span>
                </div>
              </header>

              {hasTopicContent ? (
                <EnhancedHtmlContent
                  className={`topic-content ${styles.cardContent}`}
                  html={embedHtmlImages(topic.content, embeddedImages)}
                />
              ) : (
                <section className={`topic-empty-content ${styles.cardEmptyContent}`}>
                  <Empty title="正文无内容" icon={<Inbox aria-hidden="true" />} />
                </section>
              )}

              {showAppends && topic.appends.length > 0 && (
                <div className={styles.cardAppends}>
                  {topic.appends.map((append, index) => (
                    <section
                      className={`topic-content append ${styles.cardAppend}`}
                      key={`share-append-${index}`}
                    >
                      <h2 className="append-heading">
                        <span>第 {index + 1} 条附言</span>
                        {append.time && <span className="append-time">{append.time}</span>}
                      </h2>
                      <EnhancedHtmlContent html={embedHtmlImages(append.content, embeddedImages)} />
                    </section>
                  ))}
                </div>
              )}

              {showReplies && firstPageReplies && (
                <section className={styles.cardReplies}>
                  <h2>第一页回复</h2>
                  {shareReplies.length ? (
                    shareReplies.map(reply => renderShareReply(reply))
                  ) : (
                    <p className={styles.cardEmptyReplies}>第一页暂无回复</p>
                  )}
                </section>
              )}

              <footer className={styles.cardFooter}>
                <div>
                  <strong>来自 V2EX Playground</strong>
                  <span>{topicLink}</span>
                </div>
                {showQrCode && qrCode && <img src={qrCode} alt="话题链接二维码" />}
              </footer>
            </article>
          </div>
        </SimpleBar>

        <aside className={styles.controls}>
          <div className={styles.linkField}>
            <input aria-label="话题链接" readOnly value={topicLink} />
            <Button
              aria-label="复制话题链接"
              className={styles.linkCopyButton}
              icon={<Copy aria-hidden="true" />}
              loading={copyingLink}
              size="small"
              variant="ghost"
              onClick={() => void copyLink()}
            />
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={showQrCode}
              onChange={event => setShowQrCode(event.target.checked)}
            />
            <span className={styles.checkboxMark}>
              <Check aria-hidden="true" />
            </span>
            显示分享二维码
          </label>
          {topic.appends.length > 0 && (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={showAppends}
                onChange={event => setShowAppends(event.target.checked)}
              />
              <span className={styles.checkboxMark}>
                <Check aria-hidden="true" />
              </span>
              显示作者附言
            </label>
          )}
          <div className={styles.replyOptions}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={showReplies}
                disabled={loadingReplies}
                onChange={event => void toggleReplies(event.target.checked)}
              />
              <span className={styles.checkboxMark}>
                {loadingReplies ? (
                  <Spinner aria-label="加载第一页回复" />
                ) : (
                  <Check aria-hidden="true" />
                )}
              </span>
              显示回复（第一页）
            </label>
            {showReplies && (
              <div className={styles.replyViewModeField}>
                <span>回复列表模式</span>
                <RadioGroup
                  aria-label="分享图回复列表模式"
                  className={styles.replyViewModeControl}
                  variant="segmented"
                  value={shareReplyViewMode}
                  onValueChange={value => setShareReplyViewMode(value as ReplyViewMode)}
                >
                  <RadioGroupItem value="flat" label="普通列表" />
                  <RadioGroupItem value="nested" label="楼中楼" />
                </RadioGroup>
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <Button
              disabled={loadingReplies || generating}
              icon={<Download aria-hidden="true" />}
              loading={saving}
              onClick={() => void saveImage()}
            >
              保存为图片
            </Button>
            <Button
              disabled={loadingReplies || generating}
              icon={<Copy aria-hidden="true" />}
              loading={copying}
              variant="primary"
              onClick={() => void copyImage()}
            >
              复制为图片
            </Button>
          </div>
        </aside>
      </div>
    </Dialog>
  )
}

/** 将图片 Blob 转为不含 data URL 前缀的 base64 */
async function blobToBase64(blob: Blob) {
  return (await blobToDataUrl(blob)).split(',')[1] || ''
}

/** 将 Blob 转为 data URL */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error || new Error('图片读取失败')))
    reader.readAsDataURL(blob)
  })
}

/** 读取 Webview 图片资源并转换为 data URL */
async function fetchImageDataUrl(imageSrc: string) {
  const response = await fetch(imageSrc)
  if (!response.ok) {
    throw new Error(`分享图片读取失败：HTTP ${response.status}`)
  }
  return blobToDataUrl(await response.blob())
}

/** 等待 React 将图片地址更新到 DOM */
function waitForAnimationFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

/** 恢复可能不存在的元素属性 */
function restoreAttribute(element: Element, name: string, value: string | null) {
  if (value === null) {
    element.removeAttribute(name)
    return
  }
  element.setAttribute(name, value)
}

/** 等待分享卡片中的远程图片完成加载 */
async function waitForShareImages(card: HTMLElement) {
  const images = Array.from(card.querySelectorAll<HTMLImageElement>('img[data-share-image-src]'))
  await Promise.allSettled(images.map(waitForShareImage))
}

/** 等待单张分享图片完成解码 */
function waitForShareImage(image: HTMLImageElement) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('分享图片加载超时')),
      SHARE_IMAGE_LOAD_TIMEOUT_MS
    )
    image
      .decode()
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
  })
}

/** 收集 HTML 中需要嵌入分享图的图片地址 */
function getHtmlImageSources(html: string) {
  const template = document.createElement('template')
  template.innerHTML = normalizeHtml(html)
  return Array.from(template.content.querySelectorAll<HTMLImageElement>('img'))
    .map(image => image.getAttribute('src') || '')
    .filter(Boolean)
}

/** 将已下载图片替换进分享内容 HTML */
function embedHtmlImages(html: string, embeddedImages: Record<string, string>) {
  const normalizedHtml = normalizeHtml(html)
  if (!normalizedHtml.includes('<img')) {
    return normalizedHtml
  }

  const template = document.createElement('template')
  template.innerHTML = normalizedHtml
  template.content.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    const imageSrc = image.getAttribute('src') || ''
    image.dataset.shareImageSrc = imageSrc
    image.removeAttribute('srcset')
    image
      .closest('picture')
      ?.querySelectorAll('source')
      .forEach(source => {
        source.removeAttribute('srcset')
      })
    const embeddedImage = embeddedImages[imageSrc]
    if (!embeddedImage) {
      return
    }

    image.src = embeddedImage
  })
  return template.innerHTML
}
