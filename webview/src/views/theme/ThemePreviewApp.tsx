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
  Spinner,
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

/** UI 迁移与 VS Code 主题适配回归页 */
export default function ThemePreviewApp() {
  const [activeTheme, setActiveTheme] = useState('暗色')
  const [selectedKey, setSelectedKey] = useState('v2ex')
  const [modalVisible, setModalVisible] = useState(false)
  const [inputValue, setInputValue] = useState('V2EX')
  const [otpValue, setOtpValue] = useState('12')
  const [previewPage, setPreviewPage] = useState(4)
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
          <p>检查 Radix 原语、Lucide 图标与 VS Code 语义变量</p>
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
        <PreviewSection title="基础组件">
          <div className="theme-preview-row">
            <Button variant="primary" icon={<RefreshCw aria-hidden="true" />}>
              Primary
            </Button>
            <Button>Secondary</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
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
            description="空状态不再区分明暗插画"
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
          <RadioGroup
            aria-label="回复列表展示模式"
            variant="segmented"
            value={replyViewMode}
            onValueChange={setReplyViewMode}
          >
            <RadioGroupItem value="flat" label="普通列表" />
            <RadioGroupItem value="nested" label="楼中楼" badge="BETA" badgeVariant="danger" />
          </RadioGroup>
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
            <Popover content={<div>VS Code Widget 浮层</div>}>
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
            检查遮罩、背景、边框、文字和按钮状态
          </Dialog>
        </PreviewSection>

        <PreviewSection title="复合表单">
          <div className="theme-preview-form">
            <Input placeholder="输入内容" />
            <Input disabled value="禁用输入框" />
            <Textarea placeholder="多行内容" />
            <Select
              aria-label="选择一个节点"
              placeholder="选择一个节点"
              options={[
                { label: 'V2EX', value: 'v2ex' },
                { label: 'Radix Primitives', value: 'radix' }
              ]}
            />
            <Select
              aria-label="禁用选择器"
              disabled
              value="disabled"
              options={[{ label: '禁用选择器', value: 'disabled' }]}
            />
            <div className="theme-preview-date-range" aria-label="日期范围">
              <Input aria-label="开始日期" type="date" />
              <span aria-hidden="true">~</span>
              <Input aria-label="结束日期" type="date" />
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
