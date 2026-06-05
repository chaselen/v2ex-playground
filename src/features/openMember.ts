import Config from '@/config'
import { MemberPanelController } from '@/controllers/MemberPanelController'
import type { MemberPanelInput } from '@/controllers/MemberPanelController'
import G from '@/global'

/**
 * 存放用户页面的控制器
 * key：用户主页链接
 * value：控制器
 */
const memberPanels: Record<string, MemberPanelController> = {}

/**
 * 打开用户详情页面
 * @param member 用户参数
 */
export default function openMember(member: MemberPanelInput) {
  const memberKey = G.V2ex.getMemberLink(member.username)

  // 如果控制器已经存在，则直接激活
  let controller = memberPanels[memberKey]
  if (controller) {
    controller.reveal()
    return
  }

  // 不在新标签页打开，则关闭之前的标签页重新创建
  if (!Config.openInNewTab()) {
    Object.values(memberPanels).forEach(memberPanel => {
      memberPanel.dispose()
    })
  }

  controller = new MemberPanelController(member)
  memberPanels[memberKey] = controller
  controller.onDidDispose(() => {
    delete memberPanels[memberKey]
  })
  controller.load()
}
