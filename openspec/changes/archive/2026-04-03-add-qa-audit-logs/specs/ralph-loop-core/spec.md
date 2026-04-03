## MODIFIED Requirements

### Requirement: 最小运行状态持久化

仓库 MUST 持久化 resume、cleanup 和 QA 回溯所需的最小运行状态，其中 `active-run`
只用于恢复执行，QA 审计记录使用独立文件保存。

#### Scenario: 恢复未完成运行

- **WHEN** 存在某次未完成 loop 的 active state 文件且 loop 以 resume 模式启动
- **THEN** 运行时会恢复已保存的迭代序号和运行设置
- **THEN** 并基于已保存状态继续执行

#### Scenario: 终态退出后清理 active state

- **WHEN** 某次运行已经完成、abort 或被取消并退出
- **THEN** `active-run.json` 会被删除
- **THEN** 并且不会留下陈旧的 active-run 元数据

#### Scenario: 终态退出后保留 QA 审计记录

- **WHEN** 某次 loop 运行进入终态
- **THEN** `.ralph-loop/history.jsonl` 会追加一条该次运行的摘要记录
- **THEN** 并且 `.ralph-loop/runs/<run-id>.json` 会保留该次运行的详情记录

## ADDED Requirements

### Requirement: QA 审计日志

仓库 MUST 在 `.ralph-loop/` 下为每次执行保留最小但可回溯的 QA 审计记录，且不得
默认落盘 prompt、agent 输出或用户回答正文。

#### Scenario: 运行启动时初始化 detail 记录

- **WHEN** 某次新的 loop 运行开始执行
- **THEN** `.ralph-loop/runs/<run-id>.json` 会被创建为 `running` 状态
- **THEN** 并记录 `runId`、时间、cwd、agent、model、promptSource 和 `promptLength`

#### Scenario: iteration 只记录极简摘要

- **WHEN** 某轮迭代已经结束并写入 QA 审计记录
- **THEN** 该轮只会记录 `iteration`、`exitCode`、`completed`、`tools`、`askedQuestion` 和 `answerProvided`
- **THEN** 并且仅在存在回答时附带 `answerLength`

#### Scenario: 提问交互不落盘正文

- **WHEN** agent 在某轮迭代中向用户提问且用户提供了回答
- **THEN** 日志只记录是否提问、是否回答和回答长度等元信息
- **THEN** 并且不会把回答正文写入 `.ralph-loop`

#### Scenario: 异常运行保留 crashed 记录

- **WHEN** loop 主流程在某轮执行期间抛出未处理异常
- **THEN** 该次 run 的 detail 会被标记为 `crashed`
- **THEN** 并且 `history.jsonl` 仍会保留对应的终态摘要
