import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline'
import type { Readable } from 'node:stream'
import axios from 'axios'
import vscode from 'vscode'
import G from '@/global'
import type { TopicSummaryTarget } from '@/shared/topicView'

interface SummaryInput {
  instructions: string
  source: string
}

/** 总结生成使用同一输入格式，由模型适配器处理预算与流式协议 */
export interface TopicSummaryModel {
  name: string
  fits(input: SummaryInput): Promise<boolean>
  stream(input: SummaryInput, onThinking?: () => void): Promise<AsyncIterable<string>>
}

const requestTimeout = 60_000
const customInputLimit = 18_000
const anthropicMaxOutputTokens = 2048

/** 读取用户配置的发送目标，限制为 HTTPS 或本机 HTTP */
export function getTopicSummaryTarget(): TopicSummaryTarget {
  const config = vscode.workspace.getConfiguration('v2ex.ai')

  const protocol = config.get<string>('protocol') === 'anthropic' ? 'anthropic' : 'openai'
  const model = config.get<string>('model', '').trim()
  const baseUrl = config.get<string>('baseUrl', '').trim()
  if (!baseUrl) return { protocol, endpoint: '', model }

  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error('请输入有效的模型服务 Base URL')
  }

  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(isLoopback && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Base URL 必须使用 HTTPS 或本机 HTTP，且不能包含凭据、查询参数或片段')
  }
  const path = url.pathname.replace(/\/+$/, '')
  if (protocol === 'anthropic') {
    url.pathname = path.endsWith('/v1') ? `${path}/messages` : `${path}/v1/messages`
  } else {
    url.pathname = `${path}/chat/completions`
  }
  return { protocol, endpoint: url.toString(), model }
}

function apiKeySecret(endpoint: string) {
  const digest = createHash('sha256').update(endpoint).digest('hex')
  return `topicSummary.apiKey.${digest}`
}

/** 使用宿主密码输入框添加、更换或清除当前服务的密钥 */
export async function setTopicSummaryApiKey() {
  const target = getTopicSummaryTarget()
  if (!target.endpoint) {
    throw new Error('请先在模型设置中填写 Base URL')
  }
  const secret = apiKeySecret(target.endpoint)
  const currentKey = await G.context.secrets.get(secret)
  const key = await vscode.window.showInputBox({
    title: '设置话题 AI 总结 API Key',
    prompt: `凭据仅用于 ${target.endpoint}。留空确认可清除，按 Esc 可取消`,
    value: currentKey,
    password: true,
    ignoreFocusOut: true
  })
  const nextKey = key?.trim()
  if (nextKey === undefined || nextKey === currentKey) return
  if (nextKey) {
    await G.context.secrets.store(secret, nextKey)
  } else {
    await G.context.secrets.delete(secret)
  }
}

/** 为已确认的服务准备总结输入预算与流式请求 */
export async function createTopicSummaryModel(
  target: TopicSummaryTarget,
  signal: AbortSignal
): Promise<TopicSummaryModel> {
  if (!target.endpoint || !target.model) throw new Error('请在设置中填写 Base URL 和模型 ID')
  const key = await G.context.secrets.get(apiKeySecret(target.endpoint))
  return {
    name: target.model,
    fits: async ({ instructions, source }) =>
      instructions.length + source.length <= customInputLimit,
    stream: (input, onThinking) => requestCompatibleModel(target, key, input, signal, onThinking)
  }
}

async function requestCompatibleModel(
  target: TopicSummaryTarget,
  key: string | undefined,
  { instructions, source }: SummaryInput,
  signal: AbortSignal,
  onThinking?: () => void
) {
  const userMessage = { role: 'user', content: source }
  const request =
    target.protocol === 'anthropic'
      ? {
          body: {
            system: instructions,
            messages: [userMessage],
            max_tokens: anthropicMaxOutputTokens
          },
          headers: { 'anthropic-version': '2023-06-01', ...(key && { 'x-api-key': key }) }
        }
      : {
          body: { messages: [{ role: 'system', content: instructions }, userMessage] },
          headers: key ? { Authorization: `Bearer ${key}` } : {}
        }

  try {
    const response = await axios.post<Readable>(
      target.endpoint,
      { model: target.model, stream: true, ...request.body },
      {
        headers: { Accept: 'text/event-stream', ...request.headers },
        signal,
        timeout: requestTimeout,
        maxRedirects: 0,
        responseType: 'stream'
      }
    )
    if (!String(response.headers['content-type']).toLowerCase().includes('text/event-stream')) {
      response.data.destroy()
      throw new Error('服务未返回总结所需的 SSE 流')
    }
    return readModelStream(response.data, target.protocol, onThinking)
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error
    error.response?.data?.destroy?.()
    const status = error.response?.status
    if (status === 401 || status === 403) throw new Error('服务拒绝访问，请检查 API Key 和模型权限')
    if (status === 429) throw new Error('服务请求受限，请检查额度或稍后重试')
    if (status) throw new Error(`模型服务请求失败（HTTP ${status}）`)
    throw new Error('无法连接模型服务，请检查 Base URL 和网络后重试')
  }
}

/** 按 SSE 事件边界读取正文，推理事件仅通知进度 */
export async function* readModelStream(
  stream: Readable,
  protocol: TopicSummaryTarget['protocol'],
  onThinking?: () => void
) {
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let data: string[] = []
  let finished = false
  let stopError: string | undefined
  try {
    for await (const line of lines) {
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      if (line || !data.length) continue

      const payload = data.join('\n')
      data = []
      if (protocol === 'openai' && payload === '[DONE]') return
      const event = JSON.parse(payload)
      if (event?.error || event?.type === 'error') throw new Error('模型服务返回错误')
      const choice = event?.choices?.[0]
      const stopReason =
        protocol === 'anthropic'
          ? event?.type === 'message_delta' && event.delta?.stop_reason
          : choice?.finish_reason
      if (['length', 'max_tokens', 'model_context_window_exceeded'].includes(stopReason)) {
        stopError = '模型输出达到长度上限，总结未完成。请重试或更换模型'
        break
      }
      if (stopReason === 'refusal' || stopReason === 'content_filter') {
        stopError = '模型服务中途拒绝继续生成，总结未完成'
        break
      }
      if (protocol === 'anthropic') {
        if (event?.type === 'message_stop') return
        const block = event?.type === 'content_block_start' ? event.content_block : undefined
        if (block?.type === 'text' && typeof block.text === 'string' && block.text) yield block.text
        const delta = event?.type === 'content_block_delta' ? event.delta : undefined
        if (
          block?.type === 'thinking' ||
          block?.type === 'redacted_thinking' ||
          delta?.type === 'thinking_delta'
        ) {
          onThinking?.()
        }
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') yield delta.text
        continue
      }
      if (choice?.finish_reason) finished = true
      const reasoning = choice?.delta?.reasoning_content
      if (typeof reasoning === 'string' && reasoning.trim()) onThinking?.()
      if (typeof choice?.delta?.content === 'string') yield choice.delta.content
    }
  } catch {
    throw new Error('读取模型输出失败，请重试')
  } finally {
    lines.close()
    stream.destroy()
  }
  if (stopError) throw new Error(stopError)
  if (finished) return
  throw new Error('模型输出提前中断，请重试')
}
