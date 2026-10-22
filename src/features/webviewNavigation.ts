import { resolveWebviewRoute } from './webviewRoute'

/** Webview 导航执行依赖，由面板管理层提供 */
export interface WebviewNavigationActions {
  openTopic(topicId: string, title?: string): void
  openMember(username: string): void
  openNode(name: string, title: string): void
  openTag(tag: string): void
  openHelp(slug: string, anchor?: string): void
  openCreateTopic(): void
  openBalance(): void
  openExternal(path: string): void
}

/** 根据注入的导航动作执行 URL 路由，不依赖面板管理模块 */
export function createWebviewNavigator(actions: WebviewNavigationActions) {
  return (path: string, title?: string): void => {
    const target = resolveWebviewRoute(path, title)
    if (!target) {
      actions.openExternal(path)
      return
    }
    switch (target.type) {
      case 'topic':
        actions.openTopic(target.topicId, target.title)
        break
      case 'member':
        actions.openMember(target.username)
        break
      case 'node':
        actions.openNode(target.name, target.title)
        break
      case 'tag':
        actions.openTag(target.tag)
        break
      case 'help':
        actions.openHelp(target.slug, target.anchor)
        break
      case 'createTopic':
        actions.openCreateTopic()
        break
      case 'balance':
        actions.openBalance()
        break
    }
  }
}
