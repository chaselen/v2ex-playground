# Webview RPC 通信

## 职责与组成

扩展侧与 Webview 使用 VS Code Webview 消息通道通信，公共能力分为四部分：

- `src/shared/*View.ts`：各页面的命令、事件和状态契约
- `src/shared/webviewRpc.ts`：请求、响应和类型推导等公共定义
- `src/core/WebviewRpcBridge.ts`：扩展侧请求分发、响应和事件发送
- `webview/src/shared/vscode.ts`：Webview 侧类型化客户端、超时和事件订阅

业务代码必须通过共享契约和上述封装通信，不直接调用 `postMessage` 传递业务消息。

## 通信方向

### Webview 请求扩展能力

Webview 调用类型化客户端方法后，客户端生成唯一 `requestId`，发送请求并保存对应的 Promise：

```ts
interface WebviewRequestMessage {
  command: string
  requestId: string
  args: unknown[]
}
```

扩展侧执行对应处理器后，通过内部命令 `__response` 返回结果：

```ts
interface WebviewResponseMessage<T> {
  command: '__response'
  requestId: string
  ok: boolean
  data?: T
  error?: string
}
```

Webview 根据 `requestId` 完成原 Promise。成功响应解析为返回值，失败响应转换为 `Error` 并拒绝 Promise。

### 扩展侧推送事件

扩展侧使用 `WebviewRpcBridge.post(event, payload)` 推送事件，Webview 使用 `vscode.on(event, handler)` 订阅。事件用于状态变化等后续增量同步，不承担请求响应。

## 共享契约

每个页面在 `src/shared/*View.ts` 中定义命令和事件。命令使用函数签名描述参数与业务返回值：

```ts
export interface ExampleRpcCommands {
  ready(): ExampleViewState
  refresh(force?: boolean): ExampleViewState
  loadPage(payload: { page: number; pageSize?: number }): ExamplePageData
}

export interface ExampleWebviewEvents {
  stateChanged: {
    state: ExampleViewState
  }
}
```

契约遵循以下约定：

- 命令名使用清晰的动词或动宾结构
- 命令只有一个语义值时直接传递对应类型，不为字段额外包裹对象
- 命令包含多个独立字段时使用单个对象参数，避免位置参数难以辨认
- 契约返回值描述业务数据，不需要显式声明为 `Promise`
- 共享参数和返回值复用已有领域类型，避免扩展侧与 Webview 重复定义
- 页面通用命令通过 `WebviewNavigationRpcCommands`、`WebviewStateRpcCommands<State>` 等公共接口组合

`WebviewRpcClient<Commands>` 会将契约中的所有命令转换为异步客户端方法，因此 `void` 命令在 Webview 侧也是 `Promise<void>`，其他返回值会自动使用 `Awaited` 展开。

## 扩展侧实现

Controller 或 Provider 实现 `WebviewRpcController<Commands>`。命令 `refresh` 对应公开方法 `rpc_refresh`：

```ts
class ExampleController implements WebviewRpcController<ExampleRpcCommands> {
  rpc_ready() {
    return this.viewState
  }

  async rpc_refresh(force?: boolean) {
    return this.reload(force)
  }
}
```

`WebviewRpcController` 在编译阶段检查：

- 契约中的每个命令都有对应的 `rpc_<command>` 方法
- 方法参数与契约一致
- 同步或异步返回值与契约一致

创建桥接器时直接传入当前 Controller 或 Provider：

```ts
this.rpc = new WebviewRpcBridge<ExampleRpcCommands, ExampleWebviewEvents>(this.panel.webview, this)
```

桥接器只分发带 `rpc_` 前缀的方法，并通过 `apply` 保留 Controller 的 `this` 上下文。`dispose()`、`reveal()`、`load()` 等 Panel 生命周期方法不得使用 `rpc_` 前缀。

复杂业务流程可以保留在私有方法或对应 feature/service 中，由 `rpc_` 方法作为类型安全的调用入口。

## Webview 侧调用

页面入口使用当前页面的命令和事件契约创建一次客户端：

```ts
const vscode = createVsCodeClient<ExampleRpcCommands, ExampleWebviewEvents>()
```

业务代码直接调用命令并处理 Promise：

```ts
const state = await vscode.ready()
await vscode.refresh(true)
```

订阅事件时必须保存并调用返回的取消订阅函数：

```ts
useEffect(() => {
  return vscode.on('stateChanged', ({ state }) => {
    setState(state)
  })
}, [])
```

## 状态初始化

有状态页面不能只依赖扩展侧在创建面板后推送一次初始化事件。Webview 脚本启动、React 监听注册和面板恢复之间存在时序差异，早到的事件可能丢失。

这类页面应采用以下模式：

1. 扩展侧保存最新页面状态
2. 命令契约组合 `WebviewStateRpcCommands<State>`，通过 `ready()` 返回当前状态
3. Webview 使用 `subscribeWebviewState()` 先注册状态事件，再调用 `ready()`
4. 初始化响应不得覆盖订阅期间收到的更新事件

```ts
useEffect(() => {
  return subscribeWebviewState(
    handler => vscode.on('stateChanged', data => handler(data.state)),
    () => vscode.ready(),
    setState
  )
}, [])
```

状态事件只负责 `ready()` 完成后的增量同步。

## 超时与错误

Webview 客户端为每个请求设置超时：

- 默认请求：30 秒
- `uploadImage`：60 秒

超时后客户端删除待响应请求并拒绝 Promise。迟到的响应会因找不到 `requestId` 而被忽略。

扩展侧处理器抛出异常时，桥接器记录命令名和异常，并向 Webview 返回失败响应。Webview 收到失败响应后抛出包含扩展侧错误文案的 `Error`。

桥接器会忽略缺少合法 `command`、`requestId` 或 `args` 的请求消息。未注册的命令会返回失败响应。

## 生命周期

每个 `WebviewRpcBridge` 都会注册一个 `webview.onDidReceiveMessage` 监听器。Panel 或 WebviewView 销毁时必须调用 `rpc.dispose()`，避免保留失效监听器。

Webview 侧事件订阅也必须在 React effect 清理或组件卸载时取消。局部订阅不得依赖页面刷新自动清理。

## 新增或修改 RPC

按以下顺序修改：

1. 更新 `src/shared/*View.ts` 中的命令、事件或状态契约
2. 在对应 Controller 或 Provider 中实现或修改 `rpc_<command>` 方法
3. 更新 Webview 调用或事件订阅
4. 有状态页面确认 `ready()` 与状态事件保持一致
5. 运行扩展侧与 Webview 类型检查
6. 涉及共享 RPC 契约或两侧调用链时执行完整构建

修改桥接、请求关联、错误或事件分发等公共行为时，应补充 `src/core/WebviewRpcBridge.test.ts` 中的回归测试。
