/** 图片上传参数 */
export interface ImageUploadInput {
  /** 文件名 */
  filename: string
  /** MIME 类型 */
  mimeType: string
  /** 图片 base64 内容 */
  base64: string
}
