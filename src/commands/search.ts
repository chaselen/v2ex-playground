import { TreeNode } from './../providers/BaseProvider'
import { V2ex } from './../v2ex'
import vscode from 'vscode'
import topicItemClick from './topicItemClick'
import dayjs = require('dayjs')
import { SoV2exSource, SoV2exSort } from '../type'

/**上次的搜索结果 */
var _lastSearchList: SoV2exSource[] | null = null

/**
 * 搜索逻辑
 */
export default async function search() {
  // 如果已经搜索过，直接打开上次的搜索结果
  if (_lastSearchList) {
    showQuickPick(_lastSearchList)
    return
  }

  showInputBox()
}

async function showInputBox() {
  // 输入搜索关键词
  let q = await vscode.window.showInputBox({
    placeHolder: '搜索帖子',
    prompt: '请输入查询的关键字'
  })
  // 如果用户撤销输入，如ESC，则为undefined
  if (q === undefined) {
    return
  }
  q = (q || '').trim()
  if (!q.length) {
    return
  }

  // 选择排序方式
  let sort = await vscode.window.showQuickPick(['权重', '发帖时间'], {
    placeHolder: '选择排序方式'
  })
  if (sort === undefined) {
    return
  }
  let sortType: SoV2exSort = sort === '权重' ? 'sumup' : 'created'

  const searchList = await V2ex.search(q, sortType, 0, 50)
  console.log(`<${q}>搜索到${searchList.length}条结果`)
  if (searchList.length <= 0) {
    vscode.window.showInformationMessage('没有找到相关内容')
    return
  }
  _lastSearchList = searchList
  showQuickPick(searchList)
}

async function showQuickPick(searchList: SoV2exSource[]) {
  const items = searchList.map((s, i) => {
    const dt = dayjs(s.created).format('YYYY-MM-DD')
    return {
      topicId: s.id,
      title: s.title,
      label: `${i + 1}. ${s.title}`,
      description: `@${s.member} ${dt}`,
      detail: s.content
    }
  })

  const select = await vscode.window.showQuickPick(items, {
    matchOnDescription: true,
    matchOnDetail: true,
    placeHolder: '搜索结果来自 sov2ex.com'
  })

  // 在搜索结果弹框中取消
  if (select === undefined) {
    // showInoutBox();
    _lastSearchList = null
    return
  }
  const node = new TreeNode(select.title, false)
  node.topicId = select.topicId
  topicItemClick(node)
}
