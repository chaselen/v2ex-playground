import http from '@/core/http'

/** Imgur 上传超时时间 */
const imgurUploadTimeout = 60000

/** Imgur 上传响应 */
interface ImgurResponse {
  /** 是否上传成功 */
  success: boolean
  /** 响应数据 */
  data: {
    /** 图片访问链接 */
    link: string
  }
}

/** 图片上传参数 */
export interface UploadImageOptions {
  /** 文件名 */
  filename: string
  /** MIME 类型 */
  mimeType: string
  /** 图片 base64 内容 */
  base64: string
}

/** Imgur Client ID 池 */
export const imgurClientIdPool = [
  '3107b9ef8b316f3',
  '442b04f26eefc8a',
  '59cfebe717c09e4',
  '60605aad4a62882',
  '6c65ab1d3f5452a',
  '83e123737849aa9',
  '9311f6be1c10160',
  'c4a4a563f698595',
  '81be04b9e4a08ce'
] as const satisfies readonly string[]

/**
 * 上传图片到 Imgur
 * @param options 图片上传参数
 */
export async function uploadImage(options: UploadImageOptions): Promise<string> {
  const formData = new FormData()
  const buffer = Buffer.from(options.base64, 'base64')
  const blob = new Blob([new Uint8Array(buffer)], { type: options.mimeType })

  formData.append('image', blob, options.filename)

  const randomIndex = Math.floor(Math.random() * imgurClientIdPool.length)
  const clientId = imgurClientIdPool[randomIndex]

  const res = await http.post<ImgurResponse>('https://api.imgur.com/3/upload', formData, {
    headers: { Authorization: `Client-ID ${clientId}` },
    timeout: imgurUploadTimeout
  })

  if (res.data.success) {
    return res.data.data.link
  }

  throw new Error('上传失败')
}
