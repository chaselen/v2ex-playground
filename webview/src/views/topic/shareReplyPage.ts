import type { TopicDetail } from '@extension/v2ex/types'

/** 分享回复保留完整页面响应，让显示模式和回复数据来自同一次加载 */
export type ShareReplyPageState =
  | { status: 'idle' }
  | { status: 'loading'; requestId: number; source: TopicDetail }
  | { status: 'ready'; requestId: number; source: TopicDetail; page: TopicDetail }
  | { status: 'error'; requestId: number; source: TopicDetail; message: string }

type ShareReplyPageEvent =
  | { type: 'reset' }
  | { type: 'load'; requestId: number; source: TopicDetail }
  | { type: 'loaded'; requestId: number; page: TopicDetail }
  | { type: 'failed'; requestId: number; message: string }

/** 刷新、重新打开与切换话题都会使旧请求失效，迟到的结果不能恢复旧快照 */
export function shareReplyPageReducer(
  state: ShareReplyPageState,
  event: ShareReplyPageEvent
): ShareReplyPageState {
  if (event.type === 'reset') return { status: 'idle' }
  if (event.type === 'load')
    return { status: 'loading', requestId: event.requestId, source: event.source }
  if (state.status !== 'loading' || state.requestId !== event.requestId) return state
  return event.type === 'loaded'
    ? { ...state, status: 'ready', page: event.page }
    : { ...state, status: 'error', message: event.message }
}

/** 新话题响应已渲染、加载 Effect 尚未运行时，也不能继续显示旧回复 */
export function getCurrentShareReplyPage(
  state: ShareReplyPageState,
  source: TopicDetail
): TopicDetail | undefined {
  return state.status === 'ready' && state.source === source ? state.page : undefined
}
