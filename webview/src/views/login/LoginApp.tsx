import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Cookie, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import v2exIcon from '../../../../resources/icon.png'
import {
  Alert,
  Button,
  Input,
  ScrollArea,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui'
import CookieInput from './CookieInput'
import PasswordResetDialog from './PasswordResetDialog'
import { createVsCodeClient, subscribeWebviewState } from '@/core/vscode'
import type {
  LoginPanelRpcCommands,
  LoginPanelWebviewEvents,
  LoginPanelViewState
} from '@extension/shared/webview'

const vscode = createVsCodeClient<LoginPanelRpcCommands, LoginPanelWebviewEvents>()

/** 敏感输入仅保留在组件内存，不写入 Webview 持久化状态 */
export default function LoginApp() {
  const [mode, setMode] = useState<'password' | 'cookie'>('password')
  const [resetOpen, setResetOpen] = useState(false)
  const resetTrigger = useRef<HTMLButtonElement>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [cookie, setCookie] = useState('')
  const [state, setState] = useState<LoginPanelViewState>({ loading: true, submitting: false })
  const [requestErrors, setRequestErrors] = useState({ password: '', cookie: '' })
  const error =
    requestErrors[mode] || (mode === 'password' ? state.passwordError : state.cookieError)
  const [sending, setSending] = useState(false)
  const image = useRef<string | undefined>(undefined)
  const busy = state.submitting || sending

  useEffect(
    () =>
      subscribeWebviewState(
        handler => vscode.on('state', handler),
        () => vscode.ready(),
        next => {
          if (image.current !== next.captchaImage) {
            image.current = next.captchaImage
            setCaptcha('')
          }
          if (!next.submitting) setSending(false)
          setState(next)
        },
        error => {
          setRequestErrors(current => ({ ...current, password: (error as Error).message }))
          setState({ loading: false, submitting: false })
        }
      ),
    []
  )

  function changeMode(value: string) {
    if (busy || (value !== 'password' && value !== 'cookie')) return
    setMode(value)
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || (mode === 'password' && state.loading)) return
    setSending(true)
    setRequestErrors(current => ({ ...current, [mode]: '' }))
    try {
      if (mode === 'password') {
        const input = { username, password, captcha }
        await vscode.loginWithPassword(input)
      } else {
        await vscode.loginWithCookie(cookie)
      }
    } catch (error) {
      setRequestErrors(current => ({ ...current, [mode]: (error as Error).message }))
      setSending(false)
    }
  }

  async function refreshCaptcha() {
    setRequestErrors(current => ({ ...current, password: '' }))
    setCaptcha('')
    try {
      await vscode.refreshCaptcha()
    } catch (error) {
      setRequestErrors(current => ({ ...current, password: (error as Error).message }))
    }
  }

  return (
    <ScrollArea className="login-scroll" fillViewport>
      <main className="login-page">
        <section className="login-panel" aria-labelledby="login-heading">
          <header className="login-header">
            <img className="login-brand-icon" src={v2exIcon} alt="" width={44} height={44} />
            <div>
              <div className="login-eyebrow">V2EX PLAYGROUND</div>
              <h1 id="login-heading">登录你的账号</h1>
              <p className="login-intro">继续浏览，参与感兴趣的讨论</p>
            </div>
          </header>
          <Tabs className="login-tabs" value={mode} onValueChange={changeMode}>
            <TabsList aria-label="登录方式">
              <TabsTrigger value="password" disabled={busy} tabIndex={-1}>
                <KeyRound className="login-method-icon" aria-hidden="true" />
                账号密码
              </TabsTrigger>
              <TabsTrigger value="cookie" disabled={busy} tabIndex={-1}>
                <Cookie className="login-method-icon" aria-hidden="true" />
                Cookie
              </TabsTrigger>
            </TabsList>
            <form onSubmit={submit} className="login-form">
              {error && (
                <Alert
                  variant="danger"
                  title="登录未完成"
                  description={<span className="login-error-message">{error}</span>}
                />
              )}
              <div className="login-form-content">
                <TabsContent
                  className="login-password-content"
                  value="password"
                  tabIndex={-1}
                  keepMounted
                >
                  <div className="login-fields">
                    <div className="login-field">
                      <label htmlFor="login-username">用户名或邮箱</label>
                      <Input
                        id="login-username"
                        autoFocus
                        placeholder="请输入用户名或邮箱"
                        clearable
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        value={username}
                        onValueChange={setUsername}
                        disabled={busy || mode !== 'password'}
                      />
                    </div>
                    <div className="login-field">
                      <label htmlFor="login-password">密码</label>
                      <Input
                        id="login-password"
                        placeholder="请输入密码"
                        clearable
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onValueChange={setPassword}
                        disabled={busy || mode !== 'password'}
                      />
                    </div>
                    <div className="login-field">
                      <label htmlFor="login-captcha">图片验证码</label>
                      <div className="login-captcha-controls">
                        <div className="login-captcha">
                          <div className="login-captcha-visual">
                            {state.captchaImage && !state.loading ? (
                              <Button
                                type="button"
                                className="login-captcha-image"
                                tabIndex={-1}
                                variant="ghost"
                                disabled={busy || mode !== 'password'}
                                onClick={refreshCaptcha}
                                aria-label="更换验证码"
                              >
                                <img
                                  src={state.captchaImage}
                                  alt="V2EX 登录验证码"
                                  width="320"
                                  height="80"
                                />
                              </Button>
                            ) : (
                              <div className="login-captcha-placeholder" role="status">
                                {state.loading ? (
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
                            type="button"
                            variant="ghost"
                            size="small"
                            icon={<RefreshCw />}
                            tabIndex={-1}
                            disabled={busy || mode !== 'password' || state.loading}
                            onClick={refreshCaptcha}
                          >
                            换一张
                          </Button>
                        </div>
                        <Input
                          id="login-captcha"
                          placeholder="请输入图片验证码"
                          clearable
                          autoComplete="off"
                          spellCheck={false}
                          required
                          value={captcha}
                          onValueChange={setCaptcha}
                          disabled={
                            busy || mode !== 'password' || state.loading || !state.captchaImage
                          }
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent
                  className="login-cookie-content"
                  value="cookie"
                  tabIndex={-1}
                  keepMounted
                >
                  <div className="login-field">
                    <label htmlFor="login-cookie">Cookie</label>
                    <div className="login-cookie-controls">
                      <CookieInput
                        value={cookie}
                        onValueChange={setCookie}
                        disabled={busy || mode !== 'cookie'}
                      />
                      <p className="login-hint">
                        已开启两步验证的账号可一并提供 A2O，也可在登录时输入两步验证码。
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </div>
              <div className="login-actions">
                {mode === 'password' && (
                  <Button
                    ref={resetTrigger}
                    className="login-forgot-password"
                    tabIndex={-1}
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setResetOpen(true)}
                  >
                    忘记密码？
                  </Button>
                )}
                <Button
                  className="login-submit"
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={
                    (mode === 'password' && state.loading) ||
                    (mode === 'password'
                      ? !username.trim() || !password || !captcha.trim() || !state.captchaImage
                      : !cookie.trim())
                  }
                >
                  登录
                </Button>
              </div>
            </form>
          </Tabs>
          <footer className="login-footer">
            <ShieldCheck aria-hidden="true" />
            <span>仅保存登录会话，密码不会被保存</span>
          </footer>
        </section>
        {resetOpen && (
          <PasswordResetDialog
            initialUsername={username}
            finalFocus={resetTrigger}
            onClose={() => setResetOpen(false)}
          />
        )}
      </main>
    </ScrollArea>
  )
}
