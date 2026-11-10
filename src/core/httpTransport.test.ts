import http, { type Server } from 'node:http'
import https from 'node:https'
import type { AddressInfo } from 'node:net'
import { Writable } from 'node:stream'
import axios from 'axios'
import { afterEach, expect, test, vi } from 'vitest'
import { createNativeHttpTransport } from './httpTransport'

const servers: Server[] = []
const timers: ReturnType<typeof setTimeout>[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  for (const timer of timers.splice(0)) clearTimeout(timer)
  await Promise.all(
    servers.splice(0).map(
      server =>
        new Promise<void>(resolve => {
          server.closeAllConnections()
          server.close(() => resolve())
        })
    )
  )
})

async function serve(handler: http.RequestListener) {
  const server = http.createServer(handler)
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return (server.address() as AddressInfo).port
}

test('allows DNS resolution longer than the Agent timeout and preserves the supplied Agent', async () => {
  const port = await serve((_request, response) => response.end('image'))
  const agent = new http.Agent({ keepAlive: false, timeout: 50 })
  const request = vi.spyOn(http, 'request')
  try {
    const response = await axios.get(`http://delayed.invalid:${port}/image`, {
      proxy: false,
      maxRedirects: 0,
      timeout: 1000,
      httpAgent: agent,
      transport: createNativeHttpTransport(1000),
      lookup: (_hostname, _options, callback) => {
        timers.push(setTimeout(() => callback(null, [{ address: '127.0.0.1', family: 4 }]), 150))
      }
    })
    expect(response.data).toBe('image')
    expect(request.mock.calls[0][0]).toMatchObject({ agent, timeout: 1000 })
  } finally {
    agent.destroy()
  }
})

test.each(['http', 'https'] as const)(
  'times out stalled %s DNS at the configured deadline, not the Agent timeout',
  async protocol => {
    const Agent = protocol === 'https' ? https.Agent : http.Agent
    const agent = new Agent({ keepAlive: false, timeout: 50 })
    const started = Date.now()
    try {
      await expect(
        axios.get(`${protocol}://stalled.invalid/image`, {
          proxy: false,
          maxRedirects: 0,
          timeout: 300,
          httpAgent: agent,
          httpsAgent: agent,
          transport: createNativeHttpTransport(300),
          lookup: () => {}
        })
      ).rejects.toMatchObject({ code: 'ECONNABORTED', message: 'timeout of 300ms exceeded' })
      expect(Date.now() - started).toBeGreaterThanOrEqual(250)
    } finally {
      agent.destroy()
    }
  }
)

test('keeps manual redirects visible and passes proxy routing options to the host HTTP module', async () => {
  const targets: string[] = []
  const proxyPort = await serve((request, response) => {
    targets.push(request.url!)
    response.writeHead(302, { Location: 'http://must-not-connect.invalid/image' })
    response.end()
  })
  const response = await axios.get('http://original.invalid/image', {
    proxy: { host: '127.0.0.1', port: proxyPort, protocol: 'http' },
    maxRedirects: 0,
    timeout: 1000,
    transport: createNativeHttpTransport(1000),
    validateStatus: status => status === 302
  })
  expect(response.status).toBe(302)
  expect(response.headers.location).toBe('http://must-not-connect.invalid/image')
  expect(targets).toEqual(['http://original.invalid/image'])
})

test('enforces the deadline while a host proxy is still waiting to assign a socket', async () => {
  vi.useFakeTimers()
  const request = new Writable({
    autoDestroy: false,
    write(_chunk, _encoding, callback) {
      callback()
    }
  }) as unknown as http.ClientRequest
  request.setTimeout = (_milliseconds, callback) => {
    if (callback) request.once('timeout', callback)
    return request
  }
  vi.spyOn(http, 'request').mockReturnValue(request)
  const pending = axios.get('http://proxy-wait.invalid/image', {
    proxy: false,
    timeout: 300,
    maxRedirects: 0,
    transport: createNativeHttpTransport(300)
  })
  const rejection = expect(pending).rejects.toMatchObject({ code: 'ECONNABORTED' })
  await vi.advanceTimersByTimeAsync(299)
  expect(request.destroyed).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await rejection
  expect(request.destroyed).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})
