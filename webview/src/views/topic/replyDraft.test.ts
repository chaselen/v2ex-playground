import { expect, it } from 'vitest'
import { countReplyRecipients, selectReplyDraft } from './replyDraft'
import type { TopicReply } from '@extension/v2ex/types'
const reply = {
  replyId: '12',
  floor: '3',
  userName: 'alice',
  time: '',
  content: '<p>原回复</p>'
} as TopicReply
it('空草稿选择明确目标，重复点击取消，只有提及时可切换到同名用户的另一楼', () => {
  const selected = selectReplyDraft({ content: '' }, reply)
  expect(selected.parent?.replyId).toBe('12')
  expect(selected.parent?.content).toBe('<p>原回复</p>')
  expect(selectReplyDraft(selected, reply)).toEqual({ content: '' })
  expect(selectReplyDraft(selected, { ...reply, replyId: '13' }).parent?.replyId).toBe('13')
})
it('开始写正文后只增加提及，保留原目标或回复主题状态', () => {
  const selected = selectReplyDraft({ content: '' }, reply)
  expect(
    selectReplyDraft({ ...selected, content: '@alice 收到' }, { ...reply, replyId: '15' }).parent
      ?.replyId
  ).toBe('12')
  expect(selectReplyDraft({ content: '我的看法' }, reply).parent).toBeUndefined()
})
it('仅有提及时，选择多个不同用户会取消单一楼层关联，后续点击仍回复主题', () => {
  const selected = selectReplyDraft({ content: '' }, reply)
  const multiple = selectReplyDraft(selected, { ...reply, replyId: '20', userName: 'bob' })
  expect(multiple.content).toBe('@alice \n@bob ')
  expect(multiple.parent).toBeUndefined()
  expect(multiple.multipleRecipients).toBe(true)
  expect(countReplyRecipients(multiple.content)).toBe(2)
  expect(selectReplyDraft(multiple, reply).parent).toBeUndefined()
  expect(
    selectReplyDraft({ ...multiple, content: `${multiple.content}收到` }, reply).parent
  ).toBeUndefined()
})
it('回复多人提示随正文提及数量变化，同一用户名只计一次', () => {
  expect(countReplyRecipients('@alice @ALICE @bob 收到')).toBe(2)
  expect(countReplyRecipients('@alice 收到')).toBe(1)
  expect(countReplyRecipients('正文')).toBe(0)
  const draft = selectReplyDraft(selectReplyDraft({ content: '' }, reply), {
    ...reply,
    userName: 'bob',
    replyId: '30'
  })
  expect(
    selectReplyDraft({ ...draft, content: '@alice @bob 收到' }, reply).multipleRecipients
  ).toBe(true)
})
it('同一用户的重复提及不算多用户，用户名比较不区分大小写', () => {
  const selected = selectReplyDraft({ content: '\n@ALICE \n@alice ' }, reply)
  expect(selected.parent?.replyId).toBe('12')
  expect(selected.content).toBe('\n@ALICE \n@alice \n@alice ')
})
it('已经写正文时，提及其他用户仍保留原楼层关联', () => {
  const selected = selectReplyDraft({ content: '' }, reply)
  const next = selectReplyDraft(
    { ...selected, content: '@alice 收到' },
    { ...reply, replyId: '20', userName: 'bob' }
  )
  expect(next.parent?.replyId).toBe('12')
  expect(next.content).toBe('@alice 收到\n@bob ')
})
