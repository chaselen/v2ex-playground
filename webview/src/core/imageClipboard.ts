/** 写入可作为附件粘贴的 PNG，优先复用已加载的图片 */
export async function copyImageToClipboard(
  image: HTMLImageElement,
  loadRemoteImage: (src: string) => Promise<string>,
  onPngReady?: () => void
): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前宿主不支持复制图片')
  }
  const src = image.currentSrc || image.src
  const png = encodeImage(image)
    .catch(async error => {
      if (
        !(error instanceof DOMException && error.name === 'SecurityError') ||
        !/^https?:/.test(src)
      )
        throw error
      const dataUrl = await loadRemoteImage(src)
      if (dataUrl.startsWith('data:image/png;base64,')) {
        // 扩展已校验缓存文件类型，PNG 字节可直接写入剪贴板
        return (await fetch(dataUrl)).blob()
      }
      const decoded = new Image()
      decoded.src = dataUrl
      await decoded.decode()
      return encodeImage(decoded)
    })
    .then(blob => {
      onPngReady?.()
      return blob
    })
  // 在点击回调中启动写入，图片数据可在异步读取后提供
  void png.catch(() => undefined)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

async function encodeImage(image: HTMLImageElement): Promise<Blob> {
  const { naturalWidth: width, naturalHeight: height } = image
  if (!width || !height || width * height > 32 * 1024 * 1024) {
    throw new Error('图片未加载或尺寸过大')
  }
  const canvas = image.ownerDocument.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建图片画布')
  context.drawImage(image, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('图片转换失败'))
    }, 'image/png')
  })
}
