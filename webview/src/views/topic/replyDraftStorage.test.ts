import { beforeEach, expect, test, vi } from 'vitest'
import {
  clearSubmittedReplyDraft,
  readReplyDraft,
  saveReplyDraft,
  subscribeReplyDraftCleared
} from './replyDraftStorage'

const mocks = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
vi.mock('../../core/vscode', () => ({
  getVsCodeApi: () => ({
    getState: () => mocks.state,
    setState: (state: Record<string, unknown>) => {
      mocks.state = state
    }
  })
}))

beforeEach(() => {
  mocks.state = { unrelated: 'preserve' }
})

test('a successful submission clears persistent data after its editor has unmounted', async () => {
  const submitted = saveReplyDraft('preview:1', { content: '已提交的草稿' })
  let finish!: () => void
  const request = new Promise<void>(resolve => {
    finish = resolve
  })
  const afterSubmit = request.then(() => clearSubmittedReplyDraft('preview:1', submitted))
  const mounted = vi.fn()
  const unmount = subscribeReplyDraftCleared('preview:1', mounted)
  unmount()
  finish()
  await afterSubmit
  expect(readReplyDraft('preview:1')).toBeUndefined()
  expect(mounted).not.toHaveBeenCalled()
  expect(mocks.state.unrelated).toBe('preserve')
})

test('reopening the same pending draft receives its eventual successful cleanup', () => {
  const submitted = saveReplyDraft('preview:1', { content: '正文' })
  const reopened = saveReplyDraft('preview:1', { content: '正文', multipleRecipients: false })
  expect(reopened.revision).toBe(submitted.revision)
  const reset = vi.fn()
  const unsubscribe = subscribeReplyDraftCleared('preview:1', reset)
  clearSubmittedReplyDraft('preview:1', submitted)
  expect(reset).toHaveBeenCalledExactlyOnceWith(submitted)
  unsubscribe()
})

test('late success cannot erase a newer draft, even if it was edited back to the same text', () => {
  const submitted = saveReplyDraft('preview:1', { content: '相同正文' })
  saveReplyDraft('preview:1', { content: '后续编辑' })
  const newer = saveReplyDraft('preview:1', { content: '相同正文' })
  const reset = vi.fn()
  const unsubscribe = subscribeReplyDraftCleared('preview:1', reset)
  clearSubmittedReplyDraft('preview:1', submitted)
  expect(readReplyDraft('preview:1')).toEqual(newer)
  expect(reset).not.toHaveBeenCalled()
  unsubscribe()
})

test('cleanup is scoped to the submitted topic and does not affect another editor', () => {
  const submitted = saveReplyDraft('preview:1', { content: '主题一' })
  saveReplyDraft('preview:2', { content: '主题二' })
  saveReplyDraft('main:1', { content: '主面板' })
  clearSubmittedReplyDraft('preview:1', submitted)
  expect(readReplyDraft('preview:2')?.content).toBe('主题二')
  expect(readReplyDraft('main:1')?.content).toBe('主面板')
})

test('restores legacy drafts without a revision and versions changes to the reply target', () => {
  mocks.state = { replyDrafts: { one: { content: '旧草稿' } } }
  expect(readReplyDraft('one')?.content).toBe('旧草稿')
  const original = saveReplyDraft('one', { content: '旧草稿' })
  const newer = saveReplyDraft('one', {
    content: '旧草稿',
    parent: { replyId: '2', userName: 'alice', floor: '2', content: '父回复' }
  })
  expect(newer.revision).not.toBe(original.revision)
  clearSubmittedReplyDraft('one', original)
  expect(readReplyDraft('one')?.parent?.replyId).toBe('2')
})
