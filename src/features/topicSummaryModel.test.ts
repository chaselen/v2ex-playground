import { once } from 'node:events'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { expect, test, vi } from 'vitest'
import {
  createTopicSummaryModel,
  getTopicSummaryTarget,
  readModelStream
} from './topicSummaryModel'

const { config, getSecret } = vi.hoisted(() => ({
  config: new Map<string, unknown>(),
  getSecret: vi.fn(async () => 'fixture-key')
}))
vi.mock('@/global', () => ({ default: { context: { secrets: { get: getSecret } } } }))

vi.mock('vscode', () => ({
  default: {
    workspace: {
      getConfiguration: () => ({
        get: (key: string, fallback: unknown) => config.get(key) ?? fallback
      })
    }
  }
}))

test('reads the compatible endpoint without requiring a provider setting', () => {
  expect(getTopicSummaryTarget()).toEqual({ protocol: 'openai', endpoint: '', model: '' })
  config.set('baseUrl', 'http://127.0.0.1:1234/v1/')
  config.set('model', 'local')
  expect(getTopicSummaryTarget()).toEqual({
    protocol: 'openai',
    endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
    model: 'local'
  })
  config.set('baseUrl', 'http://example.test/v1')
  expect(getTopicSummaryTarget).toThrow('HTTPS')
  config.clear()
})

test('reads split SSE frames without including reasoning or metadata in the summary', async () => {
  const response = Readable.from([
    ': keepalive\r\n\r\ndata: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}\r\n\r\n',
    'data: {"choices":\r',
    '\ndata: [{"delta":{"content":"首段"}}]}\r\n\r\n',
    'data: {"choices":[{"delta":{"content":"末段"},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n'
  ])
  const chunks = []
  for await (const chunk of readModelStream(response, 'openai', () => chunks.push('thinking'))) {
    chunks.push(chunk)
  }
  expect(chunks).toEqual(['thinking', '首段', '末段'])
})

test('reports an incomplete SSE response after yielding available text', async () => {
  const parsed = readModelStream(
    Readable.from(['data: {"choices":[{"delta":{"content":"部分内容"}}]}\n\n']),
    'openai'
  )
  await expect(parsed.next()).resolves.toEqual({ value: '部分内容', done: false })
  await expect(parsed.next()).rejects.toThrow('模型输出提前中断')
})

test.each([
  {
    protocol: 'openai' as const,
    chunk: { choices: [{ delta: { content: '部分内容' } }] },
    stop: { choices: [{ finish_reason: 'length' }] },
    error: '模型输出达到长度上限',
    end: '[DONE]'
  },
  {
    protocol: 'anthropic' as const,
    chunk: { type: 'content_block_delta', delta: { type: 'text_delta', text: '部分内容' } },
    stop: { type: 'message_delta', delta: { stop_reason: 'max_tokens' } },
    error: '模型输出达到长度上限',
    end: '{"type":"message_stop"}'
  },
  {
    protocol: 'openai' as const,
    chunk: { choices: [{ delta: { content: '部分内容' } }] },
    stop: { choices: [{ finish_reason: 'content_filter' }] },
    error: '模型服务中途拒绝继续生成',
    end: '[DONE]'
  },
  {
    protocol: 'anthropic' as const,
    chunk: { type: 'content_block_delta', delta: { type: 'text_delta', text: '部分内容' } },
    stop: { type: 'message_delta', delta: { stop_reason: 'refusal' } },
    error: '模型服务中途拒绝继续生成',
    end: '{"type":"message_stop"}'
  }
])(
  'rejects incomplete $protocol output with $error even with a normal end marker',
  async fixture => {
    const response = Readable.from([
      `data: ${JSON.stringify(fixture.chunk)}\n\n`,
      `data: ${JSON.stringify(fixture.stop)}\n\n`,
      `data: ${fixture.end}\n\n`
    ])
    const parsed = readModelStream(response, fixture.protocol)
    await expect(parsed.next()).resolves.toEqual({ value: '部分内容', done: false })
    await expect(parsed.next()).rejects.toThrow(fixture.error)
    expect(response.destroyed).toBe(true)
  }
)

test.each([
  {
    protocol: 'openai' as const,
    path: '/v1/chat/completions',
    headers: { authorization: 'Bearer fixture-key' },
    body: {
      messages: [
        { role: 'system', content: '总结' },
        { role: 'user', content: '话题文字' }
      ]
    },
    events: 'data: {"choices":[{"delta":{"content":"本地摘要"}}]}\n\ndata: [DONE]\n\n',
    progress: ['本地摘要']
  },
  {
    protocol: 'anthropic' as const,
    path: '/v1/messages',
    headers: { 'x-api-key': 'fixture-key', 'anthropic-version': '2023-06-01' },
    body: { system: '总结', max_tokens: 2048, messages: [{ role: 'user', content: '话题文字' }] },
    events: [
      'event: content_block_start\ndata: {"type":"content_block_start","content_block":{"type":"thinking","thinking":""}}',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
      'event: content_block_start\ndata: {"type":"content_block_start","content_block":{"type":"text","text":"本地"}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"摘要"}}',
      'event: message_stop\ndata: {"type":"message_stop"}',
      ''
    ].join('\n\n'),
    progress: ['thinking', '本地', '摘要']
  }
])('streams $protocol requests to a local compatible endpoint', async fixture => {
  let request
  const server = createServer(async (incoming, response) => {
    const chunks = []
    for await (const chunk of incoming) chunks.push(chunk)
    request = {
      method: incoming.method,
      path: incoming.url,
      headers: Object.fromEntries(
        Object.entries(incoming.headers).filter(([key]) =>
          ['authorization', 'x-api-key', 'anthropic-version', 'cookie'].includes(key)
        )
      ),
      body: JSON.parse(Buffer.concat(chunks).toString())
    }
    response.writeHead(200, { 'Content-Type': 'text/event-stream' })
    response.end(fixture.events)
  })
  server.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected a local port')
    const model = await createTopicSummaryModel(
      {
        protocol: fixture.protocol,
        endpoint: `http://127.0.0.1:${address.port}${fixture.path}`,
        model: 'fixture-model'
      },
      new AbortController().signal
    )
    const progress: string[] = []
    const stream = await model.stream({ instructions: '总结', source: '话题文字' }, () =>
      progress.push('thinking')
    )
    for await (const chunk of stream) {
      progress.push(chunk)
    }
    expect(progress).toEqual(fixture.progress)
    expect(request).toEqual({
      method: 'POST',
      path: fixture.path,
      headers: fixture.headers,
      body: { model: 'fixture-model', stream: true, ...fixture.body }
    })
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    )
  }
})

test.each(['https://example.test/anthropic', 'https://example.test/anthropic/v1/'])(
  'resolves the Messages endpoint from %s',
  baseUrl => {
    config.set('protocol', 'anthropic')
    config.set('baseUrl', baseUrl)
    try {
      expect(getTopicSummaryTarget()).toMatchObject({
        protocol: 'anthropic',
        endpoint: 'https://example.test/anthropic/v1/messages'
      })
    } finally {
      config.clear()
    }
  }
)

test('requires an Anthropic message_stop event to complete the stream', async () => {
  const stream = readModelStream(
    Readable.from(['data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n']),
    'anthropic'
  )
  await expect(stream.next()).rejects.toThrow('模型输出提前中断')
})
