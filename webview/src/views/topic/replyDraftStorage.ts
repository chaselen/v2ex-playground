import { getVsCodeApi } from '../../core/vscode'
import { isSameReplyDraft, type ReplyDraft } from './replyDraft'

/** 持久化版本用于阻止旧提交清除后续编辑的新草稿 */
export interface StoredReplyDraft extends ReplyDraft {
  revision?: string
}

let revisionSequence = 0
const clearedListeners = new Map<string, Set<(draft: StoredReplyDraft) => void>>()

/** 读取回复框的独立草稿，兼容没有版本号的已有数据 */
export function readReplyDraft(key?: string): StoredReplyDraft | undefined {
  if (!key) return undefined
  const drafts = getVsCodeApi().getState()?.replyDrafts as
    | Record<string, StoredReplyDraft>
    | undefined
  const draft = drafts?.[key]
  return draft && typeof draft.content === 'string' ? draft : undefined
}

/** 内容变化才创建版本；重新挂载同一草稿时保留正在提交的版本 */
export function saveReplyDraft(key: string, draft: ReplyDraft): StoredReplyDraft {
  const current = readReplyDraft(key)
  if (current?.revision && isSameReplyDraft(current, draft)) return current
  const stored = { ...draft, revision: `${Date.now()}:${++revisionSequence}` }
  const api = getVsCodeApi()
  const state = api.getState() || {}
  const drafts = state.replyDrafts as Record<string, StoredReplyDraft> | undefined
  api.setState({ ...state, replyDrafts: { ...drafts, [key]: stored } })
  return stored
}

/** 发表成功即清除对应版本，不依赖提交时的编辑器仍然挂载 */
export function clearSubmittedReplyDraft(key: string, submitted: StoredReplyDraft): void {
  if (!submitted.revision || readReplyDraft(key)?.revision !== submitted.revision) return
  const api = getVsCodeApi()
  const state = api.getState() || {}
  const drafts = { ...(state.replyDrafts as Record<string, StoredReplyDraft> | undefined) }
  delete drafts[key]
  api.setState({ ...state, replyDrafts: drafts })
  clearedListeners.get(key)?.forEach(listener => listener(submitted))
}

/** 同一草稿重新打开时，也能接收原提交的成功清理结果 */
export function subscribeReplyDraftCleared(
  key: string,
  listener: (draft: StoredReplyDraft) => void
): () => void {
  const listeners = clearedListeners.get(key) || new Set()
  listeners.add(listener)
  clearedListeners.set(key, listeners)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) clearedListeners.delete(key)
  }
}
