import { useState } from 'react'
import {
  Banner,
  Button,
  Dropdown,
  Empty,
  Input,
  Pagination,
  Popconfirm,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  TextArea,
  Toast,
  Tooltip,
  Tree
} from '@douyinfe/semi-ui'
import { VscodeBadge, VscodeTag } from '../shared/SemiVscode'

/** 可在浏览器中模拟的 VS Code 主题 */
const previewThemes = [
  { label: '亮色', bodyClass: 'vscode-light theme-preview-light' },
  { label: '暗色', bodyClass: 'vscode-dark theme-preview-dark' },
  {
    label: '高对比',
    bodyClass: 'vscode-high-contrast theme-preview-high-contrast'
  }
]

/** Semi 主题适配回归页 */
export default function ThemePreviewApp() {
  const [selectedKey, setSelectedKey] = useState('v2ex')

  const setPreviewTheme = (bodyClass: string) => {
    document.body.className = bodyClass
  }

  return (
    <main className="theme-preview">
      <header className="theme-preview-header">
        <div>
          <h1>Semi × VS Code 主题回归页</h1>
          <p>检查全局 Token、组件状态与 Portal 浮层是否跟随 VS Code Theme Color</p>
        </div>
        <Space wrap>
          {previewThemes.map(theme => (
            <Button key={theme.label} onClick={() => setPreviewTheme(theme.bodyClass)}>
              {theme.label}
            </Button>
          ))}
        </Space>
      </header>

      <section className="theme-preview-grid">
        <PreviewSection title="操作与状态">
          <Space wrap>
            <Button theme="solid" type="primary">
              Primary
            </Button>
            <Button>Default</Button>
            <Button type="danger">Danger</Button>
            <Button disabled>Disabled</Button>
            <Tooltip content="VS Code Hover Widget">
              <Button>Tooltip</Button>
            </Tooltip>
            <Popconfirm title="确认执行此操作吗？">
              <Button>Popconfirm</Button>
            </Popconfirm>
            <Dropdown
              trigger="click"
              render={
                <Dropdown.Menu>
                  <Dropdown.Item>普通菜单项</Dropdown.Item>
                  <Dropdown.Item active>选中菜单项</Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <Button>Dropdown</Button>
            </Dropdown>
          </Space>
          <Space wrap>
            <VscodeTag>Default Tag</VscodeTag>
            <VscodeTag type="solid">Solid Tag</VscodeTag>
            <VscodeBadge count={8}>
              <Button>Badge</Button>
            </VscodeBadge>
            <Progress percent={64} style={{ width: 180 }} />
            <Spin />
          </Space>
        </PreviewSection>

        <PreviewSection title="表单">
          <Space vertical align="start">
            <Input placeholder="输入内容" style={{ width: 260 }} />
            <Input disabled value="禁用输入框" style={{ width: 260 }} />
            <TextArea placeholder="多行内容" style={{ width: 260 }} />
            <Select
              placeholder="选择一个节点"
              style={{ width: 260 }}
              optionList={[
                { label: 'V2EX', value: 'v2ex' },
                { label: 'Semi Design', value: 'semi' }
              ]}
            />
          </Space>
        </PreviewSection>

        <PreviewSection title="导航与数据">
          <Tabs
            type="button"
            tabList={[
              { tab: '主题', itemKey: 'theme' },
              { tab: '组件', itemKey: 'component' }
            ]}
          />
          <Tree
            treeData={[
              {
                key: 'tech',
                label: '技术',
                value: 'tech',
                children: [{ key: 'v2ex', label: 'V2EX', value: 'v2ex' }]
              }
            ]}
            defaultExpandedKeys={['tech']}
            value={selectedKey}
            onSelect={key => setSelectedKey(key)}
          />
          <Pagination total={80} pageSize={10} />
        </PreviewSection>

        <PreviewSection title="反馈与空状态">
          <Banner
            type="info"
            title="信息提示"
            description="背景、边框与文字应来自 VS Code Theme Color"
          />
          <Space wrap>
            <Button onClick={() => Toast.success('操作成功')}>Success Toast</Button>
            <Button onClick={() => Toast.error('操作失败')}>Error Toast</Button>
          </Space>
          <Empty title="暂无内容" description="检查空状态文字层级" />
        </PreviewSection>

        <PreviewSection title="表格">
          <Table
            pagination={false}
            columns={[
              { title: '组件', dataIndex: 'component' },
              { title: '主题来源', dataIndex: 'source' }
            ]}
            dataSource={[
              { key: 'button', component: 'Button', source: '--vscode-button-*' },
              { key: 'menu', component: 'Dropdown', source: '--vscode-menu-*' }
            ]}
          />
        </PreviewSection>
      </section>
    </main>
  )
}

/** 回归页组件分组 */
function PreviewSection(props: { children: React.ReactNode; title: string }) {
  return (
    <section className="theme-preview-section">
      <h2>{props.title}</h2>
      <div className="theme-preview-stack">{props.children}</div>
    </section>
  )
}
