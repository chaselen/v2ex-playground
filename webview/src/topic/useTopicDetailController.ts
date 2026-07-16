import { useMemo, useRef } from 'react'
import { useLatestRequest } from '@/shared/useLatestRequest'
import { createVsCodeClient } from '@/shared/vscode'
import { mergeTopicMutationResult } from './topicDetailState'
import type { MemberInfo, TopicDetail } from '@extension/v2ex/types'
import type { TopicActionTarget, TopicPanelRpcCommands } from '@extension/shared/webview'

/** 话题详情 VS Code 通信客户端 */
const vscode = createVsCodeClient<TopicPanelRpcCommands>()

/** 话题详情数据适配器 */
export interface TopicDetailDataAdapter {
  /** 当前话题详情 */
  topic?: TopicDetail
  /** 是否显示图片 */
  showImages: boolean
  /** 是否可执行登录态操作 */
  canOperate: boolean
  /** 应用最新话题详情 */
  onTopicChange(topic: TopicDetail): void
  /** 刷新当前话题 */
  refresh(): Promise<TopicDetail | void>
  /** 加载回复页 */
  loadReplyPage(replyPage: number): Promise<TopicDetail | void>
}

/** 话题详情交互控制器 */
export interface TopicDetailController {
  /** 当前话题详情 */
  topic: TopicDetail
  /** 是否显示图片 */
  showImages: boolean
  /** 是否可执行登录态操作 */
  canOperate: boolean
  /** 登录 V2EX */
  login(): Promise<void>
  /** 刷新当前话题 */
  refresh(): Promise<void>
  /** 收藏话题 */
  collect(): Promise<void>
  /** 取消收藏话题 */
  cancelCollect(): Promise<void>
  /** 感谢主题创建者 */
  thankTopic(): Promise<void>
  /** 提交回复 */
  postReply(content: string): Promise<void>
  /** 感谢回复者 */
  thankReply(replyId: string): Promise<void>
  /** 加载回复页 */
  loadReplyPage(replyPage: number): Promise<void>
  /** 打开用户面板 */
  openMember(username: string): Promise<void>
  /** 加载用户快速信息 */
  loadMemberQuickInfo(username: string): Promise<MemberInfo>
  /** 打开当前话题节点 */
  openNode(): Promise<void>
  /** 打开标签主题面板 */
  openTag(tag: string): Promise<void>
}

/**
 * 为一个独立的话题详情实例创建交互控制器
 * @param adapter 详情状态适配器
 */
export default function useTopicDetailController(
  adapter: TopicDetailDataAdapter
): TopicDetailController | undefined {
  const { topic, showImages, canOperate, onTopicChange, refresh, loadReplyPage } = adapter
  const topicRef = useRef(topic)
  const { startRequest } = useLatestRequest()
  topicRef.current = topic

  return useMemo(() => {
    if (!topic) {
      return undefined
    }

    const target: TopicActionTarget = {
      topicId: topic.id,
      replyPage: topic.replyCurrentPage
    }

    /** 同步应用最新话题详情 */
    function applyTopic(nextTopic: TopicDetail) {
      topicRef.current = nextTopic
      onTopicChange(nextTopic)
    }

    /** 应用刷新或翻页返回的话题详情 */
    async function applyViewResult(task: () => Promise<TopicDetail | void>) {
      const request = startRequest()
      const nextTopic = await task()
      if (nextTopic && request.isLatest()) {
        applyTopic(nextTopic)
      }
    }

    /** 应用写操作返回的话题详情并保留较新的回复页 */
    async function applyMutationResult(task: Promise<TopicDetail>) {
      const nextTopic = await task
      const currentTopic = topicRef.current
      if (!currentTopic || String(currentTopic.id) !== String(target.topicId)) {
        return
      }

      const mergedTopic = mergeTopicMutationResult(currentTopic, nextTopic, target.replyPage || 1)
      if (mergedTopic) {
        applyTopic(mergedTopic)
      }
    }

    return {
      topic,
      showImages,
      canOperate,
      login: () => vscode.login(),
      refresh: () => applyViewResult(refresh),
      collect: () => applyMutationResult(vscode.collectTopic(target)),
      cancelCollect: () => applyMutationResult(vscode.cancelCollectTopic(target)),
      thankTopic: () => applyMutationResult(vscode.thankTopic(target)),
      postReply: content =>
        applyMutationResult(
          vscode.postTopicReply({
            ...target,
            content
          })
        ),
      thankReply: replyId =>
        applyMutationResult(
          vscode.thankTopicReply({
            ...target,
            replyId
          })
        ),
      loadReplyPage: replyPage => applyViewResult(() => loadReplyPage(replyPage)),
      openMember: username => vscode.openMember({ username }),
      loadMemberQuickInfo: username => vscode.loadMemberQuickInfo({ username }),
      openNode: () => vscode.openNode(topic.node),
      openTag: tag => vscode.openTag(tag)
    }
  }, [topic, showImages, canOperate, onTopicChange, refresh, loadReplyPage, startRequest])
}
