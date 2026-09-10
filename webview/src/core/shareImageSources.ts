/** 分享图片元素的地址属性 */
export interface ShareImageSourceAttributes {
  /** 规范化后的原始图片地址 */
  previewSrc?: string | null
  /** 图片回退地址 */
  src?: string | null
  /** 图片候选地址 */
  srcset?: string | null
  /** picture 元素中的候选地址 */
  pictureSrcsets?: readonly (string | null | undefined)[]
}

/**
 * 获取分享图片的全部候选地址
 * @param attributes 图片地址属性
 */
export function getShareImageSourceCandidates(attributes: ShareImageSourceAttributes): string[] {
  const srcsetValues = [attributes.srcset, ...(attributes.pictureSrcsets || [])]
  return Array.from(
    new Set(
      [attributes.previewSrc, attributes.src, ...srcsetValues.flatMap(parseShareImageSrcset)]
        .map(source => source?.trim() || '')
        .filter(Boolean)
    )
  )
}

/**
 * 解析 srcset 中的图片地址
 * @param srcset 图片候选地址字符串
 */
export function parseShareImageSrcset(srcset?: string | null): string[] {
  if (!srcset?.trim()) {
    return []
  }

  return Array.from(
    new Set(
      srcset
        .split(',')
        .map(candidate => candidate.trim().split(/\s+/)[0] || '')
        .filter(Boolean)
    )
  )
}
