/** 为正在加载的普通图片显示紧凑占位，并返回事件与占位的清理函数 */
export function showImageLoadingPlaceholder(img: HTMLImageElement): () => void {
  if (
    img.classList.contains('v2ex-emoticon-image') ||
    !img.getAttribute('src') ||
    (img.complete && img.naturalWidth > 0)
  ) {
    return () => {}
  }

  const placeholder = document.createElement('span')
  placeholder.className = 'content-image-placeholder'
  placeholder.setAttribute('role', 'status')
  placeholder.textContent = '图片加载中'
  img.classList.add('content-image-pending')
  img.insertAdjacentElement('afterend', placeholder)

  const loaded = () => {
    img.classList.remove('content-image-pending')
    placeholder.remove()
  }
  const failed = () => {
    placeholder.classList.add('content-image-failed')
    placeholder.textContent = '图片加载失败'
  }
  img.addEventListener('load', loaded)
  img.addEventListener('error', failed)
  // 占位期间图片没有布局盒，原生懒加载无法通过进入可视区域触发
  img.loading = 'eager'
  // 已缓存或在绑定事件前完成的图片不会再派发加载事件
  if (img.complete) {
    if (img.naturalWidth > 0) loaded()
    else failed()
  }

  return () => {
    img.removeEventListener('load', loaded)
    img.removeEventListener('error', failed)
    loaded()
  }
}
