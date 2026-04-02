# 设计：add-ralph-loop-core

## 摘要

引入一个基于 Bun、以库为中心的 `ralph-loop-core`，只负责通用 loop 运行时
行为。一个薄的 `ralph-loop` CLI 将保留当前以迭代为中心的终端体验，而像
`bin/ralph-run-openspec.ts` 这样的工作流 wrapper 则继续提供校验和运行时
prompt 文本。

## 目标

- 让可复用运行时只保留 Ralph-loop 的核心行为
- 保留 loop 执行过程中的 CLI UX
- 保留 `opencode`、`claude-code`、`codex` 和 `copilot` 的兼容性
- 支持 prompt 文件输入和运行时追加 prompt 文本
- 让失败边界清晰可见：success、abort、retry、timeout、cancel

## 非目标

- 重建完整的 `open-ralph-wiggum` 产品能力
- 在 core 运行时中嵌入 OpenSpec 规则
- 引入插件系统或工作流注册机制
- 在 v1 中加入 tasks mode、历史面板或 auto-commit

## 被放弃的方案

### 继续直接使用 `open-ralph-wiggum`

不采用。原因是仓库只需要上游运行时的一小部分能力，同时希望对工作流专属
行为有更强的控制力。

### fork `open-ralph-wiggum` 后持续瘦身

不采用。原因是上游实现把 CLI 解析、状态管理、分析、prompt 渲染和进程
控制集中在一个大模块里。相比长期维护一个瘦身 fork，直接在仓库内建立一套
清晰的最小运行时更容易理解和维护。

### 构建一个插件式编排框架

不采用。当前仓库需要的是一个小而可复用的 loop 运行时，而不是一个通用编排
平台。

## 结构草图

```text
bin/
  ralph-loop.ts
src/
  index.ts
  agents/
    types.ts
    registry.ts
    opencode.ts
    claude-code.ts
    codex.ts
    copilot.ts
  core/
    types.ts
    completion.ts
    prompt-source.ts
    state-store.ts
    process-runner.ts
    question-flow.ts
    loop-runner.ts
  ui/
    console-reporter.ts
```

## 模块职责

### `src/agents/*`

每个 adapter 负责自身 agent 的命令构造、环境变量整理、输出归一化和
question 检测。这样可以保留跨 agent 兼容性，同时避免在 loop 状态机里到处
散落 agent 分支。

### `src/core/completion.ts`

负责 ANSI 清理和终端 promise 检测。只有当最后一个非空行是
`<promise>...</promise>` 时，才认定为完成或中断。

### `src/core/prompt-source.ts`

负责组合 inline prompt、prompt-file 内容和运行时追加的 prompt 文本。
core 本身不会读取 OpenSpec 目录，也不会理解工作流专属输入。

### `src/core/state-store.ts`

只持久化 resume 和 cleanup 所需的最小 active-run 状态。历史分析、状态面板
等产品层能力继续不在范围内。

### `src/core/process-runner.ts`

使用 Bun API 启动选定 agent，流式处理 stdout 和 stderr，汇总工具使用情况，
输出 heartbeat，并在无活动超时后终止卡住的迭代。

### `src/core/question-flow.ts`

提供一个与工作流无关的 question hook。core 只负责暴露检测到的问题，并把
回答追加到下一轮迭代的 prompt 上下文中。

### `src/core/loop-runner.ts`

实现 loop 状态机：start 或 resume，执行单轮迭代，评估结果，然后继续、完成、
中断、重试或取消。

### `src/ui/console-reporter.ts`

通过 reporter 事件保留运行时终端体验：启动 banner、迭代标题、流式输出、
compact tool summary、heartbeat，以及完成、中断和取消摘要。

## 运行时流程

1. CLI 解析参数并解析 prompt 来源。
2. 选定的 agent adapter 解析可执行文件，包括 Windows `.cmd` fallback 和
   环境变量覆盖。
3. loop runner 保存最小 active state，并启动一次迭代。
4. process runner 通过 console reporter 流式输出 agent 日志。
5. loop runner 对归一化输出执行 success 或 abort promise 检测。
6. 如果没有检测到终端 promise，则递增迭代状态，并在短暂延迟后重试。
7. 当出现 success、abort、timeout 或 cancellation 时，runner 清理 active
   state，并以明确结果退出。

## Prompt 策略

第一版实现只支持：

- inline prompt text
- `--prompt-file`
- 运行时追加 prompt 文本

prompt template 被刻意延后。当前最迫切的需求是支持外部工作流 wrapper，而不
是引入一个新的模板子系统。

## 失败边界

- Success promise：清理 active state 后以 0 退出
- Abort promise：清理后以单独的非 0 退出码退出
- Agent 非 0 退出：loop 继续存活，并进入下一轮重试
- 无活动超时：终止卡住的子进程，保留 active state，并提示用户通过 resume 恢复执行
- SIGINT 或 SIGTERM：停止流式读取、终止子进程、清理状态，并以取消退出码结束

## Question 处理

question 处理保持可选。如果启用，CLI 可以通过 `readline` 暂停并收集用户输入，
然后将答案追加到下一轮迭代的 prompt 上下文中；如果禁用，loop 将不暂停，按
原有重试流程继续。

## 测试策略

- completion 检测、prompt 组合和命令解析的单元测试
- 基于 fake agent 的集成测试，用于覆盖 success、abort、retry、timeout 和
  cancellation 路径
- wrapper 验证，确认 `bin/ralph-run-openspec.ts` 变成一个基于 `ralph-loop` 的
  薄 OpenSpec 入口

## Wrapper 迁移

`bin/ralph-run-openspec.ts` 将继续保留为工作流入口，但职责会收窄为：

- 校验 `openspec/changes/<id>/`
- 组装所选 change 的运行时 prompt 文本
- 调用新的 `ralph-loop` CLI

wrapper 将不再承载通用 loop 执行逻辑。
