# dsh-think-command

在聊天里用 `/think` 查看、切换当前会话**思考（reasoning / thinking）等级**的 DeepSeek Harness 插件。
Web 聊天框（`ctx.commands` 指令适配器）和 QQ 机器人通道都能用。

> 包名是 `dsh-think-command-v3`（早期迭代留下的名字），仓库名是 `dsh-think-command`；安装时以 `github:rootAyaka/dsh-think-command` 这个仓库目标为准。

## 指令

| 指令 | 作用 |
| --- | --- |
| `/think` | 显示当前思考等级、当前模型，并列出该模型全部可切换等级 |
| `/think low` | 切换到 `low`（等级不区分大小写，也接受显示名） |
| `/think <等级>` | 切换到该模型支持的任意等级（如 `off` / `low` / `high` / `max`，以模型实际开放的等级为准） |
| `/think 高` | 中文别名：关闭 / 低 / 中 / 高 / 最高（映射到模型实际存在的等级） |

切换从**下一轮回复**开始生效；选择写入会话的 `model/selection` 事件，因此会持久保存在会话里。

## 为什么需要这个插件

Harness 的思考等级平时只能在模型选择器里点，聊天里没法直接说"这轮别想太多"或"这轮想深一点"。
`/think` 把这个能力变成一句话：不消耗模型轮次、不进入模型历史，切完下一轮就生效。

## 各通道如何工作

### Web / CLI（有 Harness 指令适配器的通道）

插件向 `ctx.commands` 注册 `/think`，输入框里直接可用；指令本身不消耗模型轮次、不进入模型历史。

### QQ 机器人（`@tencent-connect/dsh-qqbot`）

QQ 插件有自己的斜杠指令表，未知的 `/xxx` 会被当作普通消息交给模型。本插件在 QQBot 实例上做了一层薄桥接：

1. 包装 `QQBot.prototype.emit('message', …)`：在一条消息即将交给模型前检查是否为 `/think`；
2. 若是，则按 QQ 插件相同的 `sessionKey` 规则找到该 peer 的 Agent（必要时调用其 `SessionManager.getOrCreate`），
   通过 `ctx.commands.execute(agent, line, …)` 执行**与 Web 完全同一个**指令处理函数；
3. 用 `bot.sendMarkdown` 把结果直接回复到 QQ，该消息不会进入模型上下文。

QQ 里的 `/think` 回复与 QQ 插件自带的 `/model` 一致：每个可切换等级都会渲染成一个
`<qqbot-cmd-input>` **指令输入条**，点一下就把 `/think <等级>` 填进 QQ 输入框，再发送即可切换，
不用手打等级名。Web 端仍然是原来的纯文本列表（Web 输入框有自己的 `/` 指令菜单）。

没有活跃会话时的第一条 `/think` 会提示先发一条普通消息。群聊仍需 @机器人（沿用 QQ 插件自己的门禁）。

### 其他通道

任何提供 `ctx.commands` 指令适配器的通道自动获得 `/think`。没有指令适配器、也没有专门桥接的通道，只会把 `/think` 当普通文本。

## 等级如何生效

优先走 Harness 的会话级 model-selection 通道（与 Web 模型选择器同一个 `selectForNextRequest` / `model/selection` 事件）：
安装到该 Agent 上下文的请求路由，下一轮生效，并且**不会**顺手改掉 profile 的全局默认模型。
没有该服务的精简组合回退为追加 `model/selection` 事件并设置 `agent.options.reasoningEffort`。

## 安装

这是一个 DSH **bundle 型插件**：`package.json` 声明 `dsh.bundle.patch` → `cordis.patch.yml` 向 profile 插入 `command-think` 行。

用插件管理器（设置 → 插件 → 自定义安装）填：

```
github:rootAyaka/dsh-think-command
```

或命令行：

```bash
dsh plugin --profile web add github:rootAyaka/dsh-think-command
```

装完重启 `dsh web`（或在插件管理器里启用）生效。包内声明了 `dsh.bundle`，宿主会按 profile 的依赖自动挂载该 bundle，
无需手工改 `cordis.yml`。

## 仓库结构

```
dsh-think-command/
├── package.json        # bundle manifest（dsh.bundle.patch，包名 dsh-think-command-v3）
├── cordis.patch.yml    # 插入 command-think 行
├── lib/
│   ├── boot.v2.js      # 稳定入口：每次激活用唯一 URL 重新导入实现（热更新）
│   └── impl.js         # Host 插件实现：/think 指令 + QQ 桥接
└── test/
    ├── register-resolve-hook.mjs  # 复现 Host 对 @deepseek-ai/* 的运行时解析
    ├── resolve-hook.mjs
    └── qq-bridge.test.mjs         # 离线验证：指令核心 + QQ 桥接
```

`lib/boot.v2.js` 会在每次插件（重新）激活时用带唯一 query 的 URL 导入 `lib/impl.js`，
因此修改实现后不必重启 Harness：在插件管理里关闭再启用 `dsh-think-command-v3` 即可生效。

## 验证

离线自测：

```bash
node --import ./test/register-resolve-hook.mjs test/qq-bridge.test.mjs
# 或 npm test
```

覆盖等级展示/切换、中文别名、错误分支、QQ emit 拦截、SessionManager 捕获、QQ 点击填充指令条
（`<qqbot-cmd-input>`）与回复。测试需要本机装有 dsh，且默认 profile（`web`）里装了
`@tencent-connect/dsh-qqbot`（QQ 部分直接 patch 真实原型）。路径不同时用环境变量覆盖：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `DSH_ANCHOR` | `/usr/lib/node_modules/@deepseek-ai/dsh/lib/bin.js` | dsh 安装位置锚点，用于解析 `@deepseek-ai/*` |
| `DSH_PROFILE` | `web` | 从哪个 profile 找 qqbot 包 |
| `DSH_PROFILE_DIR` | `$DSH_HOME/profiles/$DSH_PROFILE` | 直接指定 profile 目录 |

在线验证：

- Web 输入框发送 `/think` 看列表；
- QQ 私聊或群里 @机器人 发送 `/think`；
- 桥接诊断：插件激活时会在 `~/.dsh/cache/dsh-think-command/bridge-status.json` 写入
  `{ ok, patched, pid, profile, ... }`；`pid` 是实际运行的 Host 进程号，`patched: true` 表示
  QQ 拦截钩子已挂到运行中的 QQBot/SessionManager 上。

## 注意

- 某些模型没有声明 `reasoningEfforts` 元数据（例如手写 profile 未给 pi-ai 模型配置等级），此时 `/think` 会明确提示"没有开放思考等级"，而不是猜测。
- QQ 桥接依赖 `@tencent-connect/dsh-qqbot` 的 `SessionManager` 内部模块路径（已在 0.5.2 验证）；升级 QQ 插件大版本后若改动该路径，桥接会记录一条 warning 并自动跳过，不影响 Web 端 `/think`。
- 本插件只切当前会话，不改 profile 里 `agent-default-model` 的全局默认值。

## License

MIT
