import { describe, expect, test } from 'vitest'
import { load } from 'cheerio/slim'
import { V2exClient } from '../client'
import { expectNode, expectTopic, expectTopicDetail } from './client.liveTestAssertions'
import { readFileSync } from 'node:fs'

const client = new V2exClient(process.env.V2EX_COOKIE)

describe.sequential('V2exClient topics', () => {
  // 编辑权限会过期；仅显式指定具有快照测试原文的新沙盒主题时运行，测试本身不写入
  const editFixtureTopicId = Number(process.env.V2EX_EDIT_FIXTURE_TOPIC_ID)
  test.skipIf(!process.env.V2EX_COOKIE || !editFixtureTopicId)(
    'reads known sandbox editor values through the facade',
    async () => {
      const fixture = JSON.parse(
        readFileSync(new URL('../parsers/fixtures/topicContent.json', import.meta.url), 'utf8')
      )
      const state = await client.topics.prepareContent(editFixtureTopicId, 'edit')
      expect(state).toMatchObject({ ...fixture.expected, nodeName: 'sandbox' })
      expect(state.syntax).toMatch(/^(default|markdown)$/)
    }
  )

  const capabilityTest = process.env.V2EX_COOKIE ? test : test.skip
  capabilityTest(
    'gets ignore capabilities for own and other authenticated topic pages',
    async () => {
      await client.refreshAuthentication()
      const username = client.getAuthenticatedUsername()!.toLowerCase()
      for (const topicId of [703733, 61465]) {
        const topic = await client.topics.getDetail(topicId)
        expect(topic.canIgnore).toBe(topic.authorName.toLowerCase() !== username)
        if (!topic.canIgnore) {
          await expect(client.topics.ignore(topicId)).rejects.toThrow('当前主题不支持忽略')
        }
      }
    }
  )

  test('matches author management capabilities to the current server page', async () => {
    const topicId = Number(process.env.V2EX_MANAGEMENT_TOPIC_ID) || 703733
    const detail = await client.topics.getDetail(topicId)
    const response = await fetch(`https://www.v2ex.com/t/${topicId}`, {
      headers: {
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...(process.env.V2EX_COOKIE ? { Cookie: process.env.V2EX_COOKIE } : {})
      }
    })
    expect(response.ok).toBe(true)
    const $ = load(await response.text())
    const actions = (['edit', 'move', 'append'] as const).filter(
      action => $(`.header > .gray a[href="/${action}/topic/${topicId}"]`).length > 0
    )
    expect(detail.canViewInfo).toBe($(`.header > .gray a[href="/t/${topicId}/info"]`).length > 0)
    if (detail.canViewInfo) {
      const info = await client.topics.getInfo(topicId)
      expect(info.fields).toContainEqual({ label: 'ID', value: String(topicId) })
      expect(info.fields.some(field => field.label === '查看人数')).toBe(true)
    }
    for (const action of ['boost', 'fade'] as const) {
      const path = action === 'boost' ? `/t/${topicId}/boost` : `/fade/topic/${topicId}`
      const available = $('#Main > .box > .inner > .fr > a[onclick]')
        .toArray()
        .some(element => {
          const script = $(element).attr('onclick') || ''
          return script.includes(`location.href = '${path}?once=`)
        })
      expect(detail.managementActions?.includes(action)).toBe(available)
      if (available) {
        const state = await client.topics.prepareManagement(topicId, action)
        expect(Object.keys(state)).toEqual(['confirmation'])
        expect(state.confirmation).toMatch(
          action === 'boost' ? /消耗 \d+ 铜币.*放到首页/ : /下沉 10 天/
        )
      }
    }
    expect(detail.contentActions).toEqual(actions)
    for (const action of actions) {
      const state = await client.topics.prepareContent(topicId, action)
      expect(state.title).toBe(detail.title)
      expect(state.nodeName).toBe(detail.node.name)
      expect(state.syntax).toMatch(/^(default|markdown)$/)
      expect(state).not.toHaveProperty('once')
      expect(state).not.toHaveProperty('fields')
    }
  })

  test('gets topics by tab and updates the online count', async () => {
    const topics = await client.topics.getListByTab('tech')
    const onlineCount = await client.account.getOnlineCount()

    expect(topics.length).toBeGreaterThan(0)
    expectTopic(topics[0])
    expect(onlineCount).toEqual(expect.any(Number))
    expect(onlineCount).toBeGreaterThan(0)
  })

  test('gets topics by node', async () => {
    const result = await client.nodes.getTopics('python')

    expect(result.totalPage).toEqual(expect.any(Number))
    expect(result.totalPage).toBeGreaterThanOrEqual(0)
    expect(result.totalCount).toEqual(expect.any(Number))
    expect(result.totalCount).toBeGreaterThan(0)
    expect(result.node).toMatchObject({
      name: 'python',
      title: 'Python',
      avatar: expect.stringMatching(/^https:\/\/cdn\.v2ex\.com\/navatar\//),
      description: expect.stringContaining('Python')
    })
    expectNode(result.node)
    expect(result.list.length).toBeGreaterThan(0)
    expectTopic(result.list[0])
    expect(result.list[0].node).toEqual(result.node)
  })

  test('gets topics by tag', async () => {
    const result = await client.topics.getListByTag('分词')

    expect(result.tag).toBe('分词')
    expect(result.totalCount).toBe(result.list.length)
    expect(result.totalCount).toBeGreaterThan(0)
    expectTopic(result.list[0])
    expect(result.list[0].authorName).toEqual(expect.any(String))
  })

  test('gets topic detail from a known public topic', async () => {
    const detail = await client.topics.getDetail(703733)

    expect(detail.id).toBe(703733)
    expect(detail.title).toBe('写了一个 VSCode 上可以逛 V2EX 的插件')
    expect(detail.node).toEqual({ name: 'create', title: '分享创造' })
    expect(detail.tags).toEqual(expect.any(Array))
    expect(detail.authorName).toBe('chaselen')
    expect(detail.displayTime).toBe('2020 年 9 月 3 日')
    expect(detail.publishedAt).toBe('2020-09-03 08:36:53')
    expect(detail.content).toContain('V2EX Playground')
    expect(detail.outdatedNotice).toMatch(
      /^这是一个创建于 \d+ 天前的主题，其中的信息可能已经有所发展或是发生改变。$/
    )
    expect(detail.replyCount).toBeGreaterThanOrEqual(42)
    expect(detail.replies.length).toBeGreaterThanOrEqual(42)
    expect(detail.replyCurrentPage).toBe(1)
    expect(detail.replies[0]).toMatchObject({
      replyId: '9452335',
      userName: 'polaa',
      repliedAt: '2020-09-03 08:41:14',
      floor: '1'
    })
    expectTopicDetail(detail)
  })

  test('gets topic summaries by id through the public domain API', async () => {
    const topics = await client.topics.getByIds([703733])
    expect(topics).toHaveLength(1)
    expect(topics[0].id).toBe(703733)
    expectTopic(topics[0])
  })

  test('gets author PRO badge from a known public topic', async () => {
    const detail = await client.topics.getDetail(443648)

    expect(detail.isAuthorPro).toBe(true)
  })

  test('gets reply MOD / OP / PRO badges from a known public topic', async () => {
    const detail = await client.topics.getDetail(443648)

    expect(detail.authorName).toBe('Livid')
    expect(detail.isAuthorPro).toBe(true)

    const authorReply = detail.replies.find(reply => reply.userName === 'Livid')
    expect(authorReply).toMatchObject({
      isMod: true,
      isOp: true,
      isPro: true
    })

    const proReply = detail.replies.find(reply => reply.userName === 'dawnven')
    expect(proReply).toMatchObject({
      isMod: false,
      isOp: false,
      isPro: true
    })
  })

  test('gets tags from a known public topic', async () => {
    const detail = await client.topics.getDetail(101091)

    expect(detail.tags).toEqual(['分词', '结果', '库算'])
  })
})

describe('V2exClient authenticated topic requests', () => {
  const authTest = process.env.V2EX_COOKIE ? test : test.skip

  authTest('previews topic markdown with V2EX_COOKIE', async () => {
    const html = await client.topics.previewContent('**主题预览**', 'markdown', 'topic')

    expect(html).toContain('<strong>主题预览</strong>')
  })

  authTest('previews default reply syntax with V2EX_COOKIE', async () => {
    const html = await client.topics.previewContent(
      ['第一行 <标签>', '', '@alice #12 https://www.v2ex.com/t/1', '**粗体**'].join('\n'),
      'default',
      'reply'
    )

    expect(html).toContain('第一行 &lt;标签&gt;<br /><br />')
    expect(html).toContain('href="/member/alice"')
    expect(html).toContain('href="https://www.v2ex.com/t/1"')
    expect(html).toContain('**粗体**')
  })

  authTest('previews a YouTube link as an embedded video with V2EX_COOKIE', async () => {
    const html = await client.topics.previewContent(
      'https://youtu.be/YhxnffqiegU',
      'default',
      'reply'
    )
    const $ = load(html)
    const iframe = $('.embedded_video_wrapper > iframe.embedded_video')

    expect(iframe).toHaveLength(1)
    expect(iframe.attr('src')).toBe('https://www.youtube.com/embed/YhxnffqiegU')
    expect(iframe.attr('allowfullscreen')).toBeDefined()
  })

  authTest('previews markdown reply syntax with V2EX_COOKIE', async () => {
    const html = await client.topics.previewContent(
      [
        '# 标题',
        '',
        '> 引用',
        '',
        '- 列表',
        '',
        '```ts',
        'const value = 1',
        '```',
        '',
        '| A | B |',
        '| - | - |',
        '| 1 | 2 |',
        '',
        '<img src="x" onerror="alert(1)">',
        '<a href="javascript:alert(2)" onclick="alert(3)">危险链接</a>'
      ].join('\n'),
      'markdown',
      'reply'
    )

    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<code class="language-ts">')
    expect(html).toContain('<table>')
    expect(html).toContain('<img class="embedded_image"')
    expect(html).toContain('<a>危险链接</a>')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('javascript:')
  })
})
