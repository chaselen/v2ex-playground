import { describe, expect, it } from 'vitest'
import { findMention, getMentionUsers, type MentionUser } from './mentions'

const user = (name: string): MentionUser => ({ name, avatar: `${name}.png` })

describe('回复用户联想', () => {
  it('裸 @ 列出所有候选并按首次出现顺序去重，保留自己', () => {
    expect(getMentionUsers(['Self', 'Alice', 'Bob', 'alice', 'SELF'].map(user), '')).toEqual([
      user('Self'),
      user('Alice'),
      user('Bob')
    ])
  })

  it('用户名筛选不区分大小写', () => {
    expect(getMentionUsers(['Alice', 'Bob'].map(user), 'LI')).toEqual([user('Alice')])
  })

  it('光标位于用户名中间时替换整个用户名，保留其后正文', () => {
    expect(findMention('正文 @Alice 后文', 6)).toEqual({ start: 3, end: 9, query: 'Al' })
    expect(findMention('@Alice', 1)).toEqual({ start: 0, end: 6, query: '' })
  })

  it('仅识别光标前的独立 @，不识别邮箱或选区', () => {
    expect(findMention('@', 1)).toEqual({ start: 0, end: 1, query: '' })
    expect(findMention('你好 @Al 后文', 6)).toEqual({ start: 3, end: 6, query: 'Al' })
    expect(findMention('a@b', 3)).toBeNull()
    expect(findMention('@Alice ', 7)).toBeNull()
    expect(findMention('@Alice', 2, 4)).toBeNull()
    expect(findMention('第一行\n@Bob', 8)).toEqual({ start: 4, end: 8, query: 'Bob' })
  })
})
