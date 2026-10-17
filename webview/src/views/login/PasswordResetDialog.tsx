import { useEffect, useRef, useState, type RefObject, type SubmitEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { Alert, Button, Dialog, Input, Spinner } from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import type { LoginPanelRpcCommands } from '@extension/shared/webview'

const vscode = createVsCodeClient<LoginPanelRpcCommands>()

interface PasswordResetDialogProps {
  initialUsername: string
  finalFocus: RefObject<HTMLButtonElement | null>
  onClose(): void
}

/** 凭据仅存在于打开期间，找回密码使用独立的验证码会话 */
export default function PasswordResetDialog({
  initialUsername,
  finalFocus,
  onClose
}: PasswordResetDialogProps) {
  const [username, setUsername] = useState(initialUsername.includes('@') ? '' : initialUsername)
  const [email, setEmail] = useState(initialUsername.includes('@') ? initialUsername : '')
  const [captcha, setCaptcha] = useState('')
  const [image, setImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const generation = useRef(0)
  const usernameInput = useRef<HTMLInputElement>(null)
  const busy = loading || submitting

  useEffect(() => {
    const current = ++generation.current
    vscode
      .startPasswordReset()
      .then(value => {
        if (generation.current === current) setImage(value)
      })
      .catch(cause => {
        if (generation.current === current) setError((cause as Error).message)
      })
      .finally(() => {
        if (generation.current === current) setLoading(false)
      })
    return () => {
      generation.current++
      void vscode.closePasswordReset().catch(console.error)
    }
  }, [])

  async function refresh() {
    const current = generation.current
    setLoading(true)
    setImage('')
    setCaptcha('')
    try {
      const value = await vscode.refreshPasswordResetCaptcha()
      if (generation.current === current) setImage(value)
    } catch (cause) {
      if (generation.current === current) setError((cause as Error).message)
    } finally {
      if (generation.current === current) setLoading(false)
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !image) return
    const current = generation.current
    setSubmitting(true)
    setError('')
    setCaptcha('')
    try {
      const message = await vscode.submitPasswordReset({ username, email, captcha })
      if (generation.current === current) setResult(message)
    } catch (cause) {
      if (generation.current === current) {
        setError((cause as Error).message)
        await refresh()
      }
    } finally {
      if (generation.current === current) setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      title="找回密码"
      description="通过注册邮箱重设密码。"
      finalFocus={finalFocus}
      initialFocus={usernameInput}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      {result ? (
        <div className="password-reset-result">
          <p role="status">{result}</p>
          <Button variant="primary" onClick={onClose}>
            返回登录
          </Button>
        </div>
      ) : (
        <form className="password-reset-form" onSubmit={submit}>
          {error && (
            <Alert
              variant="danger"
              title="找回密码未完成"
              description={<span className="login-error-message">{error}</span>}
            />
          )}
          <div className="password-reset-field">
            <label htmlFor="reset-username">用户名</label>
            <Input
              id="reset-username"
              placeholder="请输入用户名"
              ref={usernameInput}
              value={username}
              onValueChange={setUsername}
              required
              disabled={submitting}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="password-reset-field">
            <label htmlFor="reset-email">注册邮箱</label>
            <Input
              id="reset-email"
              placeholder="请输入注册邮箱"
              type="email"
              value={email}
              onValueChange={setEmail}
              required
              disabled={submitting}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="password-reset-field">
            <label htmlFor="reset-captcha">图片验证码</label>
            <div className="login-captcha">
              <div className="login-captcha-visual">
                {image ? (
                  <Button
                    className="login-captcha-image"
                    tabIndex={-1}
                    variant="ghost"
                    onClick={refresh}
                    disabled={busy}
                    aria-label="更换找回密码验证码"
                  >
                    <img src={image} alt="V2EX 找回密码验证码" width="320" height="80" />
                  </Button>
                ) : (
                  <div className="login-captcha-placeholder" role="status">
                    {loading ? (
                      <>
                        <Spinner />
                        正在加载验证码
                      </>
                    ) : (
                      '验证码尚未加载'
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="small"
                icon={<RefreshCw />}
                onClick={refresh}
                disabled={busy}
              >
                换一张
              </Button>
            </div>
            <Input
              id="reset-captcha"
              value={captcha}
              onValueChange={setCaptcha}
              placeholder="请输入图片验证码"
              required
              disabled={busy || !image}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <p className="login-hint">24 小时内，至多可以重新设置密码 2 次。</p>
          <div className="login-actions">
            <Button onClick={onClose} tabIndex={-1}>
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={loading || !image || !username.trim() || !email.trim() || !captcha.trim()}
            >
              继续
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
