import { FormEvent, useState } from 'react'
import { Banner, Button, PinCode } from '@douyinfe/semi-ui'
import { IconClose, IconTickCircle } from '@douyinfe/semi-icons'
import { createVsCodeClient } from '@/shared/vscode'
import type {
  TwoFactorPanelRpcCommands,
  TwoFactorPanelWebviewEvents
} from '@extension/shared/webview'

/** 两步验证面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<TwoFactorPanelRpcCommands, TwoFactorPanelWebviewEvents>()

/** 验证码长度 */
const twoFactorCodeLength = 6

/** 两步验证页面应用 */
export default function TwoFactorApp() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = code.length === twoFactorCodeLength && !submitting

  /**
   * 更新验证码
   * @param value 输入值
   */
  function updateCode(value: string) {
    setCode(value.replace(/\D/g, '').slice(0, twoFactorCodeLength))
    setError('')
  }

  /**
   * 提交验证码
   * @param value 验证码
   */
  async function submitCode(value: string) {
    const normalizedCode = value.replace(/\D/g, '').slice(0, twoFactorCodeLength)
    if (normalizedCode.length !== twoFactorCodeLength) {
      setError('请输入 6 位验证码')
      return
    }
    if (submitting) {
      return
    }

    setSubmitting(true)
    try {
      await vscode.verify({ code: normalizedCode })
    } catch (err) {
      setError((err as Error).message || '验证失败，请重新输入验证码')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 提交当前验证码
   * @param event 表单事件
   */
  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    void submitCode(code)
  }

  return (
    <main className="two-factor-page">
      <form className="two-factor-panel" onSubmit={submit}>
        <header className="two-factor-header">
          <div>
            <div className="two-factor-eyebrow">V2EX</div>
            <h1>两步验证</h1>
          </div>
        </header>

        <p className="two-factor-intro">你的 V2EX 账号已经开启了两步验证，请输入验证码继续</p>

        {error && <Banner type="danger" title="验证失败" description={error} />}

        <PinCode
          className={`two-factor-input${error ? ' two-factor-input--error' : ''}`}
          count={twoFactorCodeLength}
          disabled={submitting}
          format="number"
          size="large"
          value={code}
          onChange={updateCode}
          onComplete={value => submitCode(value)}
        />

        <div className="two-factor-actions">
          <Button
            type="primary"
            theme="solid"
            htmlType="submit"
            icon={<IconTickCircle />}
            loading={submitting}
            disabled={!canSubmit}
          >
            验证
          </Button>
          <Button
            theme="borderless"
            icon={<IconClose />}
            disabled={submitting}
            onClick={() => vscode.cancel()}
          >
            取消
          </Button>
        </div>
      </form>
    </main>
  )
}
