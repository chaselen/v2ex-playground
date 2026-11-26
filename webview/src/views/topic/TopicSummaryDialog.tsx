import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Bot, Copy, FileText, ListChecks, RotateCw, Sparkles, Square } from 'lucide-react'
import Markdown from 'react-markdown'
import {
  Alert,
  Button,
  Dialog,
  SplitButton,
  Empty,
  Skeleton,
  Spinner,
  Toast,
  Tooltip
} from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import type {
  TopicPanelRpcCommands,
  TopicPanelWebviewEvents,
  TopicSummaryCoverage,
  TopicSummaryResult,
  TopicSummaryTarget
} from '@extension/shared/topicView'
import styles from './TopicSummaryDialog.module.scss'

const vscode = createVsCodeClient<TopicPanelRpcCommands, TopicPanelWebviewEvents>()
const summaryDateFormat = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'long',
  timeStyle: 'medium'
})

function SummaryTime({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const minutes = Math.floor((now - timestamp) / 60_000)
  let relative = '刚刚'
  if (minutes >= 1440) relative = `${Math.floor(minutes / 1440)} 天前`
  else if (minutes >= 60) relative = `${Math.floor(minutes / 60)} 小时前`
  else if (minutes >= 1) relative = `${minutes} 分钟前`

  return (
    <Tooltip content={summaryDateFormat.format(timestamp)}>
      <time
        className={styles.summaryTime}
        dateTime={new Date(timestamp).toISOString()}
        tabIndex={0}
      >
        {relative}
      </time>
    </Tooltip>
  )
}

const copyFormats = ['Markdown', '纯文本'] as const
type CopyFormat = (typeof copyFormats)[number]

const progressLabels = {
  extracting: '正在提取正文及回复…',
  waiting: '正在等待模型响应…',
  thinking: '正在思考…',
  generating: '正在生成…'
}

/** 确认发送目标后生成总结，以 Markdown 展示流式总结 */
export default function TopicSummaryDialog({
  replyCount,
  onClose
}: {
  replyCount: number
  onClose(): void
}) {
  const [target, setTarget] = useState<TopicSummaryTarget>()
  const [targetError, setTargetError] = useState('')
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<keyof typeof progressLabels>()
  const loading = phase !== undefined
  const [settingKey, setSettingKey] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const [text, setText] = useState('')
  const [model, setModel] = useState('')
  const [coverage, setCoverage] = useState<TopicSummaryCoverage>()
  const [result, setResult] = useState<TopicSummaryResult>()
  const [readingCache, setReadingCache] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const articleRef = useRef<HTMLElement>(null)
  const canAutoStart = useRef(true)
  const activeRequest = useRef<string | undefined>(undefined)
  const targetRevision = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const skeletonHeight = useRef(0)
  const followOutput = useRef(false)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (viewport && content && loading && !text.trim()) {
      // 只保留骨架可见的高度，避免短窗口在流式输出开始时滚入留白
      const overflow = viewport.scrollHeight - viewport.clientHeight
      skeletonHeight.current = Math.max(0, content.offsetHeight - overflow)
    }
    if (viewport && text.trim() && followOutput.current) viewport.scrollTop = viewport.scrollHeight
  }, [coverage, loading, text])

  const refreshTarget = useCallback(async () => {
    const revision = ++targetRevision.current
    try {
      const current = await vscode.getTopicSummaryTarget()
      if (targetRevision.current !== revision) return
      setTarget(current)
      setTargetError('')
    } catch (error) {
      if (targetRevision.current !== revision) return
      setTarget(undefined)
      setTargetError(error instanceof Error ? error.message : '读取模型配置失败')
    }
  }, [])

  useEffect(() => {
    let disposed = false
    void vscode
      .getCachedTopicSummary()
      .then(cached => {
        if (disposed || !cached) return
        setResult(cached)
        setFromCache(true)
      })
      .catch(() => {
        if (!disposed) {
          canAutoStart.current = false
          Toast.error('无法读取本地总结')
        }
      })
      .finally(() => {
        if (!disposed) setReadingCache(false)
      })
    const unsubscribe = vscode.on('topicSummaryUpdated', ({ requestId, update }) => {
      if (activeRequest.current !== requestId) return
      switch (update.status) {
        case 'waiting':
          setModel(update.model)
          setCoverage(update.coverage)
          setPhase('waiting')
          break
        case 'thinking':
          setPhase('thinking')
          break
        case 'chunk':
          setText(current => current + update.text)
          if (update.text.trim()) setPhase('generating')
          break
        default:
          activeRequest.current = undefined
          setPhase(undefined)
          if (update.status === 'done') {
            setResult(update.result)
            setFromCache(false)
            if (!update.saved) Toast.error('总结未能保存到本地')
          }
          if (update.status === 'error') setError(update.message)
          if (update.status === 'canceled') setCanceled(true)
      }
    })
    const refreshSettings = () => void refreshTarget()
    const unsubscribeSettings = vscode.on('topicSummarySettingsChanged', refreshSettings)
    window.addEventListener('focus', refreshSettings)
    refreshSettings()
    return () => {
      disposed = true
      targetRevision.current++
      window.removeEventListener('focus', refreshSettings)
      unsubscribe()
      unsubscribeSettings()
      const requestId = activeRequest.current
      activeRequest.current = undefined
      if (requestId) void vscode.cancelTopicSummary(requestId).catch(() => {})
    }
  }, [refreshTarget])

  const generate = useCallback(async () => {
    if (!target?.endpoint || !target.model || readingCache || settingKey || activeRequest.current)
      return
    canAutoStart.current = false
    const requestId = crypto.randomUUID()
    activeRequest.current = requestId
    skeletonHeight.current = 0
    followOutput.current = true
    setError('')
    setCanceled(false)
    setText('')
    setModel('')
    setCoverage(undefined)
    setPhase('extracting')
    try {
      await vscode.startTopicSummary(requestId, target)
    } catch (error) {
      if (activeRequest.current !== requestId) return
      activeRequest.current = undefined
      setPhase(undefined)
      setError(error instanceof Error ? error.message : '总结生成失败')
      void refreshTarget()
    }
  }, [readingCache, refreshTarget, settingKey, target])

  useEffect(() => {
    if (!canAutoStart.current || readingCache || (!target && !targetError)) return
    canAutoStart.current = false
    if (!result) void generate()
  }, [generate, readingCache, result, target, targetError])

  function cancel() {
    const requestId = activeRequest.current
    if (!requestId) return
    activeRequest.current = undefined
    setPhase(undefined)
    setCanceled(true)
    void vscode.cancelTopicSummary(requestId).catch(() => {})
  }

  async function configureKey() {
    setSettingKey(true)
    try {
      await vscode.setTopicSummaryApiKey()
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : '无法设置 API Key')
    } finally {
      setSettingKey(false)
      void refreshTarget()
    }
  }

  const ready = Boolean(target?.endpoint && target.model)
  const displayedResult = loading ? undefined : result
  const displayedText = displayedResult?.text ?? text
  const hasSummary = Boolean(displayedText.trim())
  const showEmpty = !readingCache && !loading && !hasSummary && !error && !canceled && !targetError
  const displayedCoverage = displayedResult?.coverage ?? coverage
  const displayedModel = displayedResult?.model || model || target?.model
  const newReplies =
    fromCache && displayedResult ? replyCount - displayedResult.coverage.totalReplies : 0
  const generatedAt = displayedResult?.generatedAt
  const GenerateIcon = error || canceled || displayedText ? RotateCw : Sparkles

  async function copySummary(format: CopyFormat) {
    if (!displayedResult) return
    const value = format === 'Markdown' ? displayedResult.text : articleRef.current?.innerText
    if (!value?.trim()) {
      Toast.error('没有可复制的总结内容')
      return
    }
    try {
      await vscode.copyText(value)
      Toast.success(`总结已复制（${format}）`)
    } catch {
      Toast.error('复制总结失败')
    }
  }

  return (
    <Dialog
      open
      className={styles.dialog}
      viewportRef={viewportRef}
      viewportProps={{
        className: styles.viewport,
        onScroll: ({ currentTarget }) => {
          const { scrollHeight, scrollTop, clientHeight } = currentTarget
          // 滚动位置可能是小数，留出像素误差
          followOutput.current = scrollHeight - scrollTop - clientHeight <= 2
        }
      }}
      title="AI 总结"
      closeOnOverlayClick={false}
      onOpenChange={open => {
        if (!open) onClose()
      }}
      footer={
        <div className={styles.actions}>
          <div className={styles.settingsActions}>
            <Button
              disabled={loading || settingKey}
              onClick={() => {
                void vscode.openTopicSummarySettings().catch(() => Toast.error('无法打开模型设置'))
              }}
            >
              模型设置
            </Button>
            {target?.endpoint && (
              <Button disabled={loading} loading={settingKey} onClick={() => void configureKey()}>
                设置 API Key
              </Button>
            )}
          </div>
          <div className={styles.summaryActions}>
            {displayedResult && (
              <SplitButton
                icon={<Copy aria-hidden="true" />}
                title="复制为 Markdown"
                onClick={() => void copySummary('Markdown')}
                menuLabel="选择复制格式"
                side="top"
                items={copyFormats.map(format => ({
                  key: format,
                  label: `复制为 ${format}`,
                  onSelect: () => void copySummary(format)
                }))}
              >
                复制总结
              </SplitButton>
            )}
            {loading ? (
              <Button icon={<Square aria-hidden="true" fill="currentColor" />} onClick={cancel}>
                取消生成
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<GenerateIcon aria-hidden="true" />}
                disabled={!ready || settingKey || readingCache}
                title={
                  ready ? `向 ${target?.endpoint} 发送主楼、附言和纳入范围的文字回复` : undefined
                }
                onClick={() => void generate()}
              >
                {error || canceled ? '重试' : displayedText ? '重新总结' : '生成总结'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div
        className={styles.content}
        ref={contentRef}
        style={
          hasSummary && skeletonHeight.current ? { minHeight: skeletonHeight.current } : undefined
        }
      >
        {(hasSummary || (loading && displayedCoverage)) &&
          (displayedModel || displayedCoverage) && (
            <div className={styles.metadata}>
              {displayedModel && (
                <span className={styles.model}>
                  <Bot size={16} aria-hidden="true" />
                  <span>{displayedModel}</span>
                </span>
              )}
              {displayedCoverage && (
                <span className={styles.coverage}>
                  <ListChecks size={16} aria-hidden="true" />
                  <span>
                    纳入回复 {displayedCoverage.replies}/{displayedCoverage.totalReplies} 条
                    {displayedCoverage.totalPages > 0 &&
                      ` · ${displayedCoverage.pages < displayedCoverage.totalPages ? '前 ' : ''}${displayedCoverage.pages}/${displayedCoverage.totalPages} 页`}
                  </span>
                </span>
              )}
            </div>
          )}
        {displayedResult && fromCache && (
          <p className={styles.note}>
            {generatedAt === undefined ? (
              '上次总结'
            ) : (
              <>
                <SummaryTime timestamp={generatedAt} />
                生成
              </>
            )}
            {newReplies > 0 && <> · 回复比生成时多 {newReplies} 条</>}
          </p>
        )}
        {hasSummary && displayedCoverage?.truncated && (
          <p className={styles.note}>部分帖子文本或回复未纳入本次总结。</p>
        )}
        {showEmpty && target && (
          <Empty
            className={styles.empty}
            icon={<FileText />}
            title={ready ? '还没有话题总结' : '先配置模型'}
            description={
              ready
                ? '生成时会把主楼、附言和本次纳入的文字回复发送给所选模型，整理成主楼要点和回复区观点。'
                : '在「模型设置」填写 Base URL 和模型 ID，服务需要鉴权时再设置 API Key。'
            }
          >
            {ready && (
              <span className={styles.emptyModel}>
                <Bot size={16} aria-hidden="true" />
                <span>模型 · {target.model}</span>
              </span>
            )}
          </Empty>
        )}
        {!showEmpty && target && !ready && (
          <p className={styles.note}>请在模型设置填写 Base URL 和模型 ID，按需设置 API Key。</p>
        )}
        {targetError && <Alert variant="danger" title="模型配置有误" description={targetError} />}
        {error && <Alert variant="danger" title="生成失败" description={error} />}
        {phase && (
          <p className={`${styles.note} ${styles.progress}`} role="status">
            <Spinner aria-hidden="true" />
            {progressLabels[phase]}
          </p>
        )}
        {loading && !hasSummary && (
          <Skeleton active className={styles.summarySkeleton} aria-hidden="true">
            {[1, 3, 3].map((rows, index) => (
              <div key={index}>
                <Skeleton.Title className={styles.skeletonHeading} />
                <Skeleton.Paragraph rows={rows} />
              </div>
            ))}
          </Skeleton>
        )}
        {canceled && <p role="status">已取消生成。</p>}
        {hasSummary && (
          <article ref={articleRef} className={styles.result} aria-label="总结正文">
            <Markdown skipHtml disallowedElements={['a', 'img']} unwrapDisallowed>
              {displayedText}
            </Markdown>
          </article>
        )}
      </div>
    </Dialog>
  )
}
