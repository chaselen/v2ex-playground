import { readFileSync } from 'node:fs'
import { load } from 'cheerio/slim'
import { describe, expect, it } from 'vitest'
import { parseReplies, parseReplyThreadStyle } from './topic'
import type { ReplyThreadStyle } from '../types'

// 2026-11-16 真实话题 1257325；仅保留回复区，移除操作 token 与脚本
const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/replyThreads.json', import.meta.url), 'utf8')
) as Record<string, string>
const baseline = parseReplies(load(fixtures.off))
const official = parseReplies(load(fixtures.f))

describe('seven official reply layouts', () => {
  it('preserves every server-provided quote level without an arbitrary 20-level cutoff', () => {
    let quote = ''
    for (let floor = 1; floor <= 24; floor++) {
      quote = `<div class="reply-quote"><div class="reply-quote-head"><a href="#r_${floor}">user${floor}</a><span class="reply-quote-no">#${floor}</span></div>${quote ? `<details class="reply-quote-up"><summary>上文</summary>${quote}</details>` : ''}<div class="reply-quote-text">第 ${floor} 层正文</div></div>`
    }
    const $ = load(
      `<div id="topic-replies"><div class="box reply-threads reply-threads-h"><div id="r_25" class="cell"><strong><a class="dark" href="/member/current">current</a></strong><span class="no">25</span>${quote}<div class="reply_content">本层正文</div></div></div></div>`
    )
    const replies = parseReplies($)
    expect(replies).toHaveLength(1)
    expect(load(replies[0].content).text()).toBe('本层正文')
    const floors: string[] = []
    for (let parent = replies[0].parent; parent; parent = parent.parent) floors.push(parent.floor)
    expect(floors).toEqual(Array.from({ length: 24 }, (_, index) => String(24 - index)))
  })
  for (const mode of ['off', 'a', 'b', 'c', 'd', 'f', 'h'] as ReplyThreadStyle[]) {
    it(`${mode}: preserves every reply, original floors and own metadata`, () => {
      const $ = load(fixtures[mode])
      const replies = parseReplies($)
      expect(parseReplyThreadStyle($)).toBe(mode)
      expect(replies.map(reply => reply.replyId)).toEqual(baseline.map(reply => reply.replyId))
      for (const reply of replies) {
        const original = baseline.find(item => item.replyId === reply.replyId)!
        expect(reply).toMatchObject({
          floor: original.floor,
          userName: original.userName,
          content: original.content,
          isOp: original.isOp,
          isMod: original.isMod,
          isPro: original.isPro
        })
        expect(reply.parent?.replyId).toBe(
          mode === 'off'
            ? undefined
            : official.find(item => item.replyId === reply.replyId)?.parent?.replyId
        )
      }
      expect(replies.find(reply => reply.floor === '6')?.parent?.floor).toBe(
        mode === 'off' ? undefined : '2'
      )
      expect(replies.find(reply => reply.floor === '17')?.parent?.floor).toBe(
        mode === 'off' ? undefined : '14'
      )
    })
  }
  it.each(['f', 'c', 'd'])(
    '%s: preserves page two and external parent links without reparenting',
    mode => {
      const replies = parseReplies(load(fixtures[mode + 'Page2']))
      expect(replies).toHaveLength(15)
      expect(replies[0].floor).toBe('101')
      expect(replies[0].parent).toMatchObject({ floor: '96', url: '/t/1257325?p=1#r_18294727' })
      expect(replies.find(reply => reply.floor === '113')?.parent?.floor).toBe('107')
    }
  )
  it('does not treat quote and strip lookalikes in reply content as official targets', () => {
    const $ = load(fixtures.a)
    $('.reply_content')
      .first()
      .append(
        '<div class="reply-quote"><div class="reply-quote-head"><a href="#r_999999">fake</a></div><div class="reply-quote-text">fake content</div></div><a class="reply-strip" href="#r_999999">fake</a>'
      )
    expect(parseReplies($)[0].parent).toBeUndefined()
  })
  it('preserves official answered chips including replies on another page', () => {
    const replies = parseReplies(load(fixtures.b))
    expect(replies.find(reply => reply.floor === '5')?.answeredBy).toEqual([
      {
        replyId: '18294823',
        floor: '104',
        userName: 'panlista',
        url: '/t/1257325?p=2#r_18294823',
        content: ''
      }
    ])
    expect(replies.find(reply => reply.floor === '2')?.answeredBy).toEqual([
      expect.objectContaining({ floor: '6', userName: '121819756', url: '#r_18293805' })
    ])
    expect(replies.find(reply => reply.floor === '5')?.parent?.floor).toBe('4')
  })
  it('ignores answered chip lookalikes in reply content', () => {
    const $ = load(fixtures.b)
    $('.reply_content')
      .first()
      .append(
        '<div class="reply-answered"><a class="reply-chip" href="#r_999999">#999 fake</a></div>'
      )
    expect(parseReplies($)[0].answeredBy).toBeUndefined()
  })
  it('unknown modes fall back to off', () => {
    expect(
      parseReplyThreadStyle(
        load('<div id="topic-replies"><div class="reply-threads reply-threads-new"></div></div>')
      )
    ).toBe('off')
  })
  it('ignores forged reply cells inside user content but retains official nested replies', () => {
    const $ = load(fixtures.c)
    $('.reply_content')
      .first()
      .append('<div id="r_999999" class="cell"><div class="reply_content">伪造回复</div></div>')
    expect(load(parseReplies($)[0].content).text()).toContain('伪造回复')
    expect(parseReplies($).map(reply => reply.replyId)).toEqual(
      baseline.map(reply => reply.replyId)
    )
  })
})
