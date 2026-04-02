# ralph-loop-core 增量规范

## ADDED Requirements

### Requirement: 与工作流解耦的 Loop Core

仓库 MUST 提供一个基于 Bun 的 `ralph-loop-core` 运行时，它只负责通用 loop
行为，且不得硬编码 OpenSpec 或其他工作流专属规则。

#### Scenario: OpenSpec 校验由 wrapper 负责

- 假定某个 OpenSpec wrapper 会在启动前校验 `openspec/changes/<id>/`
- 当 loop core 启动时
- 那么 core 只接收 prompt 输入、运行时选项和 agent 配置
- 并且 core 自身不会检查 OpenSpec 目录结构

### Requirement: 外部 Prompt 组合

仓库 MUST 支持通过 inline prompt 文本、外部 prompt 文件，以及可选的运行时
追加 prompt 文本来执行 loop。

#### Scenario: 基于 prompt 文件并追加运行时文本

- 假定调用方同时提供 prompt 文件和运行时 prompt 文本
- 当 loop 构建本轮迭代 prompt 时
- 那么 prompt 文件内容会作为基础 prompt
- 并且运行时文本会以追加方式拼接，而不会修改原文件

#### Scenario: 只使用 inline prompt

- 假定调用方只提供 inline prompt 文本
- 当 loop 启动时
- 那么 loop 直接使用该文本
- 并且不强制要求提供 prompt 文件

### Requirement: 多 Agent 兼容性

仓库 MUST 通过专用 agent adapter 保留对 `opencode`、`claude-code`、
`codex` 和 `copilot` 的兼容性。

#### Scenario: Agent 专属参数映射

- 假定调用方选择了受支持的 agent 和可选 model
- 当 adapter 构建命令时
- 那么生成的参数必须符合该 agent 的 CLI 约定
- 并且 loop runner 不需要为该 agent 增加工作流专属分支

#### Scenario: Windows 可执行文件 fallback

- 假定某个受支持 agent 在 Windows 上以 `.cmd` 可执行文件形式安装
- 当 adapter 解析二进制路径时
- 那么运行时会在需要时回退到 `.cmd` 变体
- 并且仍然支持环境变量覆盖

### Requirement: Loop 边界处理

仓库 MUST 将 success、abort、非零退出、无活动超时和用户取消视为不同的
loop 结果。

#### Scenario: Success promise 完成 loop

- 假定某轮迭代的最后一个非空行是 `<promise>COMPLETE</promise>`
- 当 loop 对归一化输出执行评估时
- 那么本次运行会以成功状态结束
- 并且 active loop state 会被清理

#### Scenario: Abort promise 以失败中断 loop

- 假定某轮迭代的最后一个非空行是配置好的 abort promise
- 当 loop 对归一化输出执行评估时
- 那么本次运行会以单独的 abort 结果退出
- 并且 active loop state 会被清理

#### Scenario: Agent 非零退出后继续重试

- 假定 agent 进程以非零退出码结束，且没有出现 abort promise
- 当 loop 处理本轮结果时
- 那么本轮失败会被记录下来
- 并且下一轮迭代会自动继续

#### Scenario: 无活动超时后提示恢复执行

- 假定某轮迭代在配置的无活动超时时间内没有任何输出
- 当达到超时阈值时
- 那么运行时会终止卡住的子进程
- 并且 active state 会被保留，以便用户之后通过 resume 恢复执行

#### Scenario: 用户中断取消运行

- 假定当前存在一个正在运行的 loop
- 当用户发送 SIGINT 或 SIGTERM
- 那么运行时会停止流式读取、终止子进程、清理 active state，并以取消结果退出

### Requirement: 运行时 CLI UX

仓库 MUST 为活跃 loop 执行提供内建的运行时 CLI 报告能力，同时不能把工作流
管理能力耦合进 loop core。

#### Scenario: 迭代生命周期可见

- 假定某次 loop 运行已经启动
- 当多轮迭代持续执行时
- 那么 CLI 会展示启动 banner、迭代标题、流式输出和迭代摘要

#### Scenario: 安静阶段的 heartbeat 提示

- 假定某轮迭代已经运行了一段时间，但没有新的可见输出
- 当 heartbeat 间隔到达时
- 那么 CLI 会输出包含已耗时长和最近活动时间的进度提示

### Requirement: 最小运行状态持久化

仓库 MUST 只持久化 resume 和 cleanup 所需的最小 active-run 状态。

#### Scenario: 恢复未完成运行

- 假定存在某次未完成 loop 的 active state 文件
- 当 loop 以 resume 模式启动时
- 那么运行时会恢复已保存的迭代序号和运行设置
- 并且会基于已保存状态继续执行

#### Scenario: 终态退出后清理状态

- 假定某次运行已经完成、abort 或被取消
- 当 loop 退出时
- 那么 active state 文件会被删除
- 并且不会留下陈旧的 active-run 元数据

### Requirement: 可选的 Question 处理

仓库 MUST 通过与工作流无关的交互 hook 支持可选的 question 处理。

#### Scenario: 启用 question 处理

- 假定某个受支持 agent 在迭代过程中提出了用户问题
- 当 question 处理功能启用时
- 那么 CLI 可以暂停并等待用户输入
- 并且该回答会被追加到下一轮迭代上下文中

#### Scenario: 禁用 question 处理

- 假定某个受支持 agent 在迭代过程中提出了用户问题
- 当 question 处理功能被禁用时
- 那么 loop 不会为交互输入而暂停
- 并且运行会按正常重试流程继续
