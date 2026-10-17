import NodeSelectButton from '@/components/NodeSelectButton'
import type { Node } from '@extension/v2ex/types'
import { useState, type ReactNode } from 'react'
import {
  Bookmark,
  ChevronDown,
  Heart,
  Inbox,
  RefreshCw,
  Search,
  Tag as TagIcon
} from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ConfirmPopover,
  ContextMenu,
  DatePicker,
  Dialog,
  DropdownMenu,
  Empty,
  Input,
  OtpInput,
  Pagination,
  Popover,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Select,
  ScrollArea,
  Spinner,
  Skeleton,
  Tag,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  Toast
} from '@/components/ui'

/** 可在浏览器中模拟的 VS Code 主题 */
const previewThemes = [
  { label: '亮色', bodyClass: 'vscode-light theme-preview-light' },
  { label: '暗色', bodyClass: 'vscode-dark theme-preview-dark' },
  {
    label: '高对比',
    bodyClass: 'vscode-high-contrast theme-preview-high-contrast'
  },
  {
    label: '高对比亮色',
    bodyClass: 'vscode-high-contrast-light theme-preview-high-contrast-light'
  }
]

/** VS Code 主题适配回归页 */
export default function ThemePreviewApp() {
  const [activeTheme, setActiveTheme] = useState('暗色')
  const [selectedKey, setSelectedKey] = useState('v2ex')
  const [modalVisible, setModalVisible] = useState(false)
  const [contextMenuDisabled, setContextMenuDisabled] = useState(false)
  const [node, setNode] = useState<Node | undefined>({ name: 'qna', title: '问与答' })
  const [inputValue, setInputValue] = useState('V2EX')
  const [otpValue, setOtpValue] = useState('12')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [previewPage, setPreviewPage] = useState(4)
  const [fillViewport, setFillViewport] = useState(true)
  const [scrollRows, setScrollRows] = useState(3)
  const [replyViewMode, setReplyViewMode] = useState('nested')

  const setPreviewTheme = (label: string, bodyClass: string) => {
    setActiveTheme(label)
    document.body.className = bodyClass
  }

  return (
    <main className="theme-preview">
      <header className="theme-preview-header">
        <div>
          <h1>Webview UI × VS Code 主题回归页</h1>
          <p>检查 Base UI、Lucide 图标与 VS Code 语义变量</p>
        </div>
        <div className="theme-preview-row">
          {previewThemes.map(theme => (
            <Button
              key={theme.label}
              aria-pressed={activeTheme === theme.label}
              variant={activeTheme === theme.label ? 'primary' : 'subtle'}
              onClick={() => setPreviewTheme(theme.label, theme.bodyClass)}
            >
              {theme.label}
            </Button>
          ))}
        </div>
      </header>

      <section className="theme-preview-grid">
        <PreviewSection title="滚动区域">
          <Button onClick={() => setScrollRows(rows => (rows === 3 ? 30 : 3))}>切换滚动内容</Button>
          <ScrollArea
            className="theme-preview-scroll"
            viewportProps={{ role: 'region', 'aria-label': '滚动区域示例' }}
          >
            <div className="theme-preview-scroll-sticky">置顶内容：滚动条应保持可见和可点击</div>
            {Array.from({ length: scrollRows }, (_, index) => (
              <p key={index}>第 {index + 1} 行：检查动态内容和键盘滚动</p>
            ))}
            <div className="theme-preview-scroll-wide">横向滚动内容</div>
          </ScrollArea>
        </PreviewSection>
        <PreviewSection title="内容填充视口">
          <Button onClick={() => setFillViewport(value => !value)} aria-pressed={fillViewport}>
            {fillViewport ? '关闭视口填充' : '开启视口填充'}
          </Button>
          <ScrollArea
            fillViewport={fillViewport}
            className="theme-preview-scroll-fill"
            contentClassName="theme-preview-scroll-fill-content"
            viewportProps={{ role: 'region', 'aria-label': '视口填充示例' }}
          >
            <p>短内容的背景应随填充开关变化</p>
          </ScrollArea>
        </PreviewSection>
        <PreviewSection title="基础组件">
          <div className="theme-preview-row">
            <Button variant="primary" icon={<RefreshCw aria-hidden="true" />}>
              Primary
            </Button>
            <Button>Secondary</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
            <Button
              compact
              size="small"
              variant="ghost"
              aria-label="紧凑搜索"
              icon={<Search aria-hidden="true" />}
            />
            <Button variant="danger">Danger</Button>
          </div>
          <div className="theme-preview-row">
            <Button variant="primary" disabled>
              Primary disabled
            </Button>
            <Button variant="secondary" disabled>
              Secondary disabled
            </Button>
            <Button variant="subtle" disabled>
              Subtle disabled
            </Button>
            <Button variant="ghost" disabled>
              Ghost disabled
            </Button>
            <Button variant="danger" disabled>
              Danger disabled
            </Button>
          </div>
          <div className="theme-preview-row">
            <Avatar fallback="V" />
            <Tag>Default Tag</Tag>
            <Tag variant="badge">PRO</Tag>
            <Badge count={8} />
            <Spinner />
          </div>
          <div className="theme-preview-row">
            <Button size="small" variant="subtle">
              节点名称
            </Button>
            <Button
              size="small"
              variant="subtle"
              icon={<TagIcon className="theme-preview-small-icon" aria-hidden="true" />}
            >
              标签
            </Button>
            <span className="theme-preview-status">
              <Bookmark aria-hidden="true" fill="currentColor" />
              已收藏
            </span>
            <span className="theme-preview-status theme-preview-status--success">
              <Heart aria-hidden="true" fill="currentColor" />
              感谢已发送
            </span>
          </div>
          <Progress value={64} />
          <Alert title="VS Code 主题提示" description="背景、边框与文字直接来自项目语义变量" />
          <Empty
            className="theme-preview-empty"
            icon={<Inbox />}
            title="暂无内容"
            description="空状态使用统一插画"
          />
        </PreviewSection>

        <PreviewSection title="表单与分页">
          <Input
            className="theme-preview-input"
            prefix={<Search aria-hidden="true" />}
            clearable
            placeholder="搜索内容"
            value={inputValue}
            onValueChange={setInputValue}
          />
          <Input
            className="theme-preview-input"
            disabled
            value="禁用输入框"
            onValueChange={() => undefined}
          />
          <OtpInput
            className="theme-preview-otp"
            length={6}
            value={otpValue}
            onValueChange={setOtpValue}
          />
          <Pagination
            page={previewPage}
            totalPages={12}
            showQuickJumper
            onPageChange={setPreviewPage}
          />
          <Pagination compact page={previewPage} totalPages={12} onPageChange={setPreviewPage} />
          <RadioGroup
            aria-label="回复列表展示模式"
            variant="segmented"
            value={replyViewMode}
            onValueChange={setReplyViewMode}
          >
            <RadioGroupItem value="flat" label="普通列表" />
            <RadioGroupItem value="nested" label="楼中楼" />
          </RadioGroup>
        </PreviewSection>

        <PreviewSection title="控件禁用态对照">
          <NodeSelectButton node={node} aria-label="可用节点选择器" />
          <NodeSelectButton node={node} disabled aria-label="禁用节点选择器" />
          <NodeSelectButton node={node} loading aria-label="加载中节点选择器" />
          <NodeSelectButton disabled aria-label="禁用空节点选择器" />
          <Pagination
            page={2}
            totalPages={12}
            showQuickJumper
            disabled
            onPageChange={() => undefined}
          />

          <Input prefix={<Search aria-hidden="true" />} placeholder="可输入" />
          <Input prefix={<Search aria-hidden="true" />} placeholder="禁用输入" disabled />
          <Textarea placeholder="可编辑文本" />
          <Textarea placeholder="禁用文本域" disabled />
          <Select
            aria-label="可用选择器"
            placeholder="请选择"
            options={[{ value: 'one', label: '选项一' }]}
          />
          <Select aria-label="禁用选择器" placeholder="请选择（禁用）" options={[]} disabled />
          <DatePicker aria-label="可用日期" />
          <DatePicker aria-label="禁用日期" clearable value="2026-01-15" disabled />
          <OtpInput length={6} value="123" disabled onValueChange={() => undefined} />
          <RadioGroup aria-label="单选禁用态对照" defaultValue="enabled">
            <RadioGroupItem value="enabled" label="可用" />
            <RadioGroupItem value="disabled" label="禁用" disabled />
          </RadioGroup>
          <RadioGroup aria-label="禁用选中项" defaultValue="disabled" disabled>
            <RadioGroupItem value="disabled" label="已选中（禁用）" />
          </RadioGroup>
          <RadioGroup aria-label="分段禁用态对照" variant="segmented" defaultValue="enabled">
            <RadioGroupItem value="enabled" label="可用" />
            <RadioGroupItem value="disabled" label="禁用" disabled />
          </RadioGroup>
          <Tabs defaultValue="enabled">
            <TabsList>
              <TabsTrigger value="enabled">可用标签</TabsTrigger>
              <TabsTrigger value="disabled" disabled>
                禁用标签
              </TabsTrigger>
            </TabsList>
            <TabsContent value="enabled">禁用项悬停时应保持禁用样式</TabsContent>
          </Tabs>
        </PreviewSection>

        <PreviewSection title="操作与状态">
          <div className="theme-preview-row">
            <Tooltip content="VS Code Hover Widget">
              <Button>Tooltip</Button>
            </Tooltip>
            <ConfirmPopover
              title="确认执行此操作吗？"
              onConfirm={() => Toast.success('确认操作成功')}
            >
              <Button>Confirm</Button>
            </ConfirmPopover>
            <ConfirmPopover
              title="确认执行危险操作吗？"
              description="操作完成后无法恢复"
              danger
              onConfirm={() => Toast.success('危险操作已确认')}
            >
              <Button variant="danger">Danger Confirm</Button>
            </ConfirmPopover>
            <Popover tooltip="点击打开浮层" content={<div>VS Code Widget 浮层</div>}>
              <Button>Popover</Button>
            </Popover>
            <DropdownMenu
              items={[
                { key: 'normal', label: '普通菜单项' },
                { key: 'active', label: '选中菜单项', active: true },
                { key: 'disabled', label: '禁用菜单项', disabled: true }
              ]}
            >
              <Button>Dropdown</Button>
            </DropdownMenu>
            <Badge count={8}>
              <Button>Badge</Button>
            </Badge>
            <Button onClick={() => setModalVisible(true)}>Dialog</Button>
            <Button
              aria-pressed={contextMenuDisabled}
              onClick={() => setContextMenuDisabled(value => !value)}
            >
              {contextMenuDisabled ? '启用右键菜单' : '禁用右键菜单'}
            </Button>
            <ContextMenu
              disabled={contextMenuDisabled}
              items={[
                { key: 'copy', label: '复制', onSelect: () => Toast.success('已复制') },
                { key: 'disabled', label: '禁用菜单项', disabled: true }
              ]}
            >
              <div>
                <Input aria-label="右键菜单状态保留" defaultValue="切换禁用状态后保留输入" />
              </div>
            </ContextMenu>
            <ConfirmPopover
              tooltip="组合触发器提示"
              title="确认组合触发器操作？"
              onConfirm={() => Toast.success('已确认')}
            >
              <Button>组合触发器</Button>
            </ConfirmPopover>
          </div>
          <Dialog
            title="Dialog 主题回归"
            open={modalVisible}
            footer={
              <>
                <Button onClick={() => setModalVisible(false)}>取消</Button>
                <Button variant="primary" onClick={() => setModalVisible(false)}>
                  确认
                </Button>
              </>
            }
            onOpenChange={setModalVisible}
          >
            <p>检查遮罩、背景、边框、文字和按钮状态</p>
            <Select
              aria-label="对话框内选择"
              placeholder="选择组件"
              options={[
                { label: 'Base UI', value: 'base-ui' },
                { label: 'V2EX', value: 'v2ex' }
              ]}
            />
          </Dialog>
        </PreviewSection>

        <PreviewSection title="表单控件尺寸">
          {(['default', 'small', 'large'] as const).map(size => (
            <div className="theme-preview-form" key={size} data-control-size={size}>
              <strong>
                {{ default: '默认 32px', small: '紧凑 28px', large: '大号 36px' }[size]}
              </strong>
              <Input size={size} aria-label={`${size} 输入框`} placeholder="输入内容" />
              <Select
                size={size}
                aria-label={`${size} 选择器`}
                defaultValue="v2ex"
                options={[{ label: 'V2EX', value: 'v2ex' }]}
              />
              <DatePicker size={size} aria-label={`${size} 日期`} />
              <NodeSelectButton size={size} node={node} />
              <RadioGroup size={size} aria-label={`${size} 单选组`} defaultValue="any">
                <RadioGroupItem value="any" label="任意关键词" />
                <RadioGroupItem value="all" label="全部关键词" />
              </RadioGroup>
              <RadioGroup
                size={size}
                variant="segmented"
                aria-label={`${size} 分段单选组`}
                defaultValue="any"
              >
                <RadioGroupItem value="any" label="任意关键词" />
                <RadioGroupItem value="all" label="全部关键词" />
              </RadioGroup>
              <Button size={size}>操作按钮</Button>
              <Skeleton.Button size={size} />
            </div>
          ))}
        </PreviewSection>

        <PreviewSection title="复合表单">
          <div className="theme-preview-form">
            <Input placeholder="输入内容" />
            <Input disabled value="禁用输入框" />
            <Textarea placeholder="多行内容" />
            <Select
              clearable
              defaultValue="v2ex"
              aria-label="选择一个节点"
              placeholder="选择一个节点"
              options={[
                { label: 'V2EX', value: 'v2ex' },
                { label: 'Base UI', value: 'base-ui' }
              ]}
            />
            <NodeSelectButton
              node={node}
              clearable
              onClear={() => setNode(undefined)}
              onClick={() => setNode({ name: 'qna', title: '问与答' })}
            />
            <Select
              aria-label="禁用选择器"
              disabled
              value="disabled"
              options={[{ label: '禁用选择器', value: 'disabled' }]}
            />
            <div className="theme-preview-date-range" aria-label="日期范围">
              <DatePicker
                clearable
                aria-label="开始日期"
                placeholder="开始日期"
                value={dateStart}
                onValueChange={setDateStart}
              />
              <span aria-hidden="true">~</span>
              <DatePicker
                clearable
                aria-label="结束日期"
                placeholder="结束日期"
                value={dateEnd}
                onValueChange={setDateEnd}
              />
            </div>
          </div>
        </PreviewSection>

        <PreviewSection title="导航与数据">
          <Tabs className="theme-preview-overflow-tabs" defaultValue="theme">
            <TabsList overflowNavigation>
              <TabsTrigger value="theme">主题</TabsTrigger>
              <TabsTrigger value="component">组件</TabsTrigger>
              <TabsTrigger value="navigation">导航</TabsTrigger>
              <TabsTrigger value="feedback">反馈</TabsTrigger>
              <TabsTrigger value="data">数据展示</TabsTrigger>
            </TabsList>
            <TabsContent value="theme">主题内容</TabsContent>
            <TabsContent value="component">组件内容</TabsContent>
            <TabsContent value="navigation">导航内容</TabsContent>
            <TabsContent value="feedback">反馈内容</TabsContent>
            <TabsContent value="data">数据展示内容</TabsContent>
          </Tabs>
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="theme-preview-tree-trigger">
              <ChevronDown aria-hidden="true" />
              技术
            </CollapsibleTrigger>
            <CollapsibleContent className="theme-preview-tree-content">
              <button
                type="button"
                className="theme-preview-tree-item"
                aria-pressed={selectedKey === 'v2ex'}
                onClick={() => setSelectedKey('v2ex')}
              >
                V2EX
              </button>
            </CollapsibleContent>
          </Collapsible>
          <Pagination page={1} totalPages={8} onPageChange={() => undefined} />
          <Pagination compact page={3} totalPages={8} onPageChange={() => undefined} />
        </PreviewSection>

        <PreviewSection title="反馈与空状态">
          <Alert
            variant="info"
            title="信息提示"
            description="背景、边框与文字应来自 VS Code Theme Color"
          />
          <Alert variant="warning" title="警告提示" description="检查语义色及其对比度" />
          <Alert variant="danger" title="错误提示" description="检查错误前景、背景与边框" />
          <div className="theme-preview-row">
            <Button onClick={() => Toast.success('操作成功')}>Success Toast</Button>
            <Button onClick={() => Toast.error('操作失败')}>Error Toast</Button>
          </div>
          <Empty
            className="theme-preview-empty"
            title="暂无内容"
            description="检查空状态文字层级"
          />
        </PreviewSection>

        <PreviewSection title="表格">
          <table className="theme-preview-table">
            <thead>
              <tr>
                <th scope="col">组件</th>
                <th scope="col">主题来源</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Button</td>
                <td>--vscode-button-*</td>
              </tr>
              <tr>
                <td>Dropdown</td>
                <td>--vscode-menu-*</td>
              </tr>
            </tbody>
          </table>
        </PreviewSection>
      </section>
    </main>
  )
}

/** 回归页组件分组 */
function PreviewSection(props: { children: ReactNode; title: string }) {
  return (
    <section className="theme-preview-section">
      <h2>{props.title}</h2>
      <div className="theme-preview-stack">{props.children}</div>
    </section>
  )
}
