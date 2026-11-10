import type { TopicPanelRpcCommands } from '@extension/shared/topicView'
import type { WebviewRpcClient } from '@extension/shared/webviewRpc'

type ShareImageClient = WebviewRpcClient<
  Pick<TopicPanelRpcCommands, 'loadTopicShareImages' | 'cancelTopicShareImages'>
>

/** RPC 超时或失败时取消对应批次，确认后台退出后才允许继续 */
export async function loadCancellableShareImages(
  client: ShareImageClient,
  sources: string[],
  format?: 'resourceUri' | 'dataUrl'
) {
  const loadId = crypto.randomUUID()
  try {
    return await client.loadTopicShareImages(loadId, sources, format)
  } catch (error) {
    await client.cancelTopicShareImages(loadId).catch(() => undefined)
    throw error
  }
}

/** 单次 RPC 与扩展侧 12 路下载并发对齐，避免一批内排队多轮 */
const SHARE_IMAGE_BATCH_SIZE = 12

/** 顺序加载分享图片，每批完成后立即交给预览或截图使用 */
export async function* loadShareImageBatches(
  imageSources: string[],
  loadImages: (sources: string[]) => Promise<Record<string, string>>
) {
  for (let index = 0; index < imageSources.length; index += SHARE_IMAGE_BATCH_SIZE) {
    const sources = imageSources.slice(index, index + SHARE_IMAGE_BATCH_SIZE)
    let images: Record<string, string> = {}
    try {
      images = await loadImages(sources)
    } catch {
      // 单批 RPC 失败时保留其他批次，缺失图片继续使用透明占位图
    }
    yield { sources, images }
  }
}
