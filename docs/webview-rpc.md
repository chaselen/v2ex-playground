# Webview RPC 通信

## 契约与分发边界

页面契约集中在 `src/shared/*View.ts`，公共协议与类型推导在 `src/shared/webviewRpc.ts`。扩展侧由 `src/core/WebviewRpcBridge.ts` 分发，Webview 通过 `webview/src/core/vscode.ts` 的类型化客户端调用，不直接发送业务消息。

命令以函数签名描述参数和业务返回值，客户端统一转换为 Promise。单个语义值直接传递，多字段使用对象；两侧复用领域类型，公共导航和状态命令通过共享接口组合。

桥接器仅允许调用 `rpc_<command>` 方法，生命周期方法不能使用该前缀。`WebviewRpcController<Commands>` 检查处理器与契约一致，但消息仍须通过运行时校验；无效消息忽略，未知命令返回失败响应。

请求通过唯一 `requestId` 关联响应，失败响应转换为 Error。事件用于状态增量同步，不承担请求响应。超时只结束客户端等待，不能撤回已经执行的远程写操作；迟到响应被忽略。

## 状态初始化

扩展侧创建面板后推送一次初始化事件并不可靠。不同宿主（如 Cursor 与 VS Code）的脚本启动、React 监听注册和面板恢复时序可能不同，早到事件会丢失。

有状态页面由扩展侧保存最新状态，契约组合 `WebviewStateRpcCommands<State>`。Webview 使用 `subscribeWebviewState()` 先订阅事件，再调用 `ready()` 主动读取；若等待期间收到新事件，旧初始化响应不能覆盖它。

销毁面板时释放桥接器，组件卸载时取消事件订阅，避免旧实例继续响应。

## 宿主序列化

部分宿主会把消息参数数组中的 `undefined` 转为 `null`。客户端发送前移除末尾的 `undefined`，以保留省略可选参数时的 JavaScript 默认值语义；不要依赖宿主保留数组中的 `undefined`。

## 验证边界

修改契约时同时更新扩展侧处理器和 Webview 调用方，执行两侧类型检查与完整构建。修改消息分发、请求关联或错误处理时运行桥接器回归测试。

初始化或面板复用变化还需在 VS Code、Cursor 中验证首次打开、重复打开和隐藏恢复，确认页面不会因事件丢失而停留在加载态。
