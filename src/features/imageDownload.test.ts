import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const cancellation = { dispose: vi.fn() }
  const token = {
    onCancellationRequested: vi.fn().mockReturnValue(cancellation)
  }
  const destination = {
    fsPath: '/tmp/image.png',
    path: '/tmp/image.png',
    scheme: 'file',
    toString: vi.fn().mockReturnValue('file:///tmp/image.png')
  }
  const savedDirectory = {
    toString: vi.fn().mockReturnValue('file:///tmp')
  }

  return {
    cancellation,
    destination,
    executeCommand: vi.fn(),
    fileTypeFromBuffer: vi.fn(),
    globalStateGet: vi.fn(),
    globalStateUpdate: vi.fn(),
    httpGet: vi.fn(),
    loggerError: vi.fn(),
    loggerWarn: vi.fn(),
    savedDirectory,
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showSaveDialog: vi.fn(),
    showWarningMessage: vi.fn(),
    uriFile: vi.fn(),
    uriJoinPath: vi.fn(),
    uriParse: vi.fn(),
    withProgress: vi.fn((_options, task) => task({}, token)),
    writeFile: vi.fn()
  }
})

vi.mock('node:os', () => ({
  homedir: () => '/home/test'
}))

vi.mock('file-type', () => ({
  fileTypeFromBuffer: mocks.fileTypeFromBuffer
}))

vi.mock('vscode', () => ({
  default: {
    ProgressLocation: {
      Notification: 15
    },
    commands: {
      executeCommand: mocks.executeCommand
    },
    window: {
      showErrorMessage: mocks.showErrorMessage,
      showInformationMessage: mocks.showInformationMessage,
      showSaveDialog: mocks.showSaveDialog,
      showWarningMessage: mocks.showWarningMessage,
      withProgress: mocks.withProgress
    },
    workspace: {
      fs: {
        writeFile: mocks.writeFile
      }
    }
  },
  Uri: {
    file: mocks.uriFile,
    joinPath: mocks.uriJoinPath,
    parse: mocks.uriParse
  }
}))

vi.mock('@/core/http', () => ({
  default: {
    get: mocks.httpGet
  }
}))

vi.mock('@/core/logger', () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn
  }
}))

vi.mock('@/global', () => ({
  default: {
    context: {
      globalState: {
        get: mocks.globalStateGet,
        update: mocks.globalStateUpdate
      }
    }
  }
}))

import { downloadImage } from './imageDownload'

describe('downloadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' })
    mocks.globalStateGet.mockReturnValue(undefined)
    mocks.globalStateUpdate.mockResolvedValue(undefined)
    mocks.httpGet.mockResolvedValue({ data: new Uint8Array([1, 2, 3]) })
    mocks.showInformationMessage.mockResolvedValue(undefined)
    mocks.showSaveDialog.mockResolvedValue(mocks.destination)
    mocks.uriFile.mockImplementation(path => ({ path }))
    mocks.uriJoinPath.mockReturnValue(mocks.savedDirectory)
    mocks.uriParse.mockImplementation(value => ({ value }))
  })

  test('downloads a validated image and writes the selected URI', async () => {
    mocks.showInformationMessage.mockResolvedValue('查看')

    await downloadImage('https://example.com/path/avatar.jpg?size=large')

    expect(mocks.httpGet).toHaveBeenCalledWith(
      'https://example.com/path/avatar.jpg?size=large',
      expect.objectContaining({
        responseType: 'arraybuffer',
        signal: expect.any(AbortSignal)
      })
    )
    expect(mocks.uriFile).toHaveBeenCalledWith('/home/test')
    expect(mocks.uriJoinPath).toHaveBeenCalledWith({ path: '/home/test' }, 'avatar.png')
    expect(mocks.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultUri: mocks.savedDirectory,
        filters: { 图片: ['png'] },
        saveLabel: '保存图片'
      })
    )
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith(
      'v2ex.imageDownload.lastDirectory',
      'file:///tmp'
    )
    expect(mocks.writeFile).toHaveBeenCalledWith(
      mocks.destination,
      expect.objectContaining({ 0: 1, 1: 2, 2: 3 })
    )
    expect(mocks.showInformationMessage).toHaveBeenCalledWith('图片已保存：/tmp/image.png', '查看')
    expect(mocks.executeCommand).toHaveBeenCalledWith('revealFileInOS', mocks.destination)
    expect(mocks.cancellation.dispose).toHaveBeenCalledOnce()
  })

  test('reuses the last selected directory for the next suggested filename', async () => {
    const directory = { path: '/remote/downloads' }
    const defaultUri = { path: '/remote/downloads/avatar.png' }
    mocks.globalStateGet.mockReturnValue('vscode-remote://host/remote/downloads')
    mocks.uriParse.mockReturnValue(directory)
    mocks.uriJoinPath.mockImplementation((_base, segment) =>
      segment === '..' ? mocks.savedDirectory : defaultUri
    )

    await downloadImage('https://example.com/avatar.jpg')

    expect(mocks.uriParse).toHaveBeenCalledWith('vscode-remote://host/remote/downloads')
    expect(mocks.uriJoinPath).toHaveBeenCalledWith(directory, 'avatar.png')
    expect(mocks.showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({ defaultUri }))
  })

  test('shows a readable path for non-file destinations', async () => {
    const destination = {
      fsPath: '/remote/image.png',
      path: '/remote/image.png',
      scheme: 'vscode-remote'
    }
    mocks.showSaveDialog.mockResolvedValue(destination)
    mocks.showInformationMessage.mockResolvedValue('查看')

    await downloadImage('https://example.com/image.png')

    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      '图片已保存：/remote/image.png',
      '查看'
    )
    expect(mocks.executeCommand).toHaveBeenCalledWith('revealInExplorer', destination)
  })

  test('rejects invalid image URLs before requesting them', async () => {
    await downloadImage('javascript:alert(1)')

    expect(mocks.showWarningMessage).toHaveBeenCalledWith('仅支持下载格式正确的 http 或 https 图片')
    expect(mocks.httpGet).not.toHaveBeenCalled()
  })

  test('reports non-image remote content through VS Code notifications', async () => {
    mocks.fileTypeFromBuffer.mockResolvedValue(undefined)

    await downloadImage('https://example.com/not-an-image')

    expect(mocks.writeFile).not.toHaveBeenCalled()
    expect(mocks.loggerError).toHaveBeenCalledOnce()
    expect(mocks.showErrorMessage).toHaveBeenCalledWith('图片下载失败：远程内容不是有效图片')
  })

  test('does not report user cancellation as a download failure', async () => {
    mocks.httpGet.mockRejectedValue({ code: 'ERR_CANCELED' })

    await downloadImage('https://example.com/image.png')

    expect(mocks.showErrorMessage).not.toHaveBeenCalled()
    expect(mocks.loggerError).not.toHaveBeenCalled()
    expect(mocks.cancellation.dispose).toHaveBeenCalledOnce()
  })
})
