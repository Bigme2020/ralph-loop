## Why

当前 `.ralph-loop/` 目录主要只承担 `active-run` 的恢复职责，正常执行结束后常常只剩一个空目录，无法支持 QA 回看每次 run 的结果和过程摘要。现在已经落地了一套最小 QA 审计日志能力，需要按 OpenSpec 流程把这个行为正式记录为能力变更，而不是直接改主 spec。

## What Changes

- 为 `ralph-loop-core` 增加 `.ralph-loop/` 下的 QA 审计日志能力
- 将单次运行拆分为 `history.jsonl` 摘要索引和 `runs/<run-id>.json` 详情记录两层
- 明确 iteration 只记录极简摘要字段，不默认落盘 prompt、agent 输出或用户回答正文
- 明确 loop 主流程异常时仍需保留 `crashed` 状态的 run 记录

## Capabilities

### New Capabilities
- `qa-audit-logs`: 定义 `.ralph-loop/` 下按 run 保留 QA 审计日志的能力边界

### Modified Capabilities
- `ralph-loop-core`: 扩展运行状态持久化要求，使 core 除 `active-run` 外还保留最小 QA 审计记录

## Impact

- 影响 `src/core/loop-runner.ts`、`src/core/state-store.ts` 周边的运行时持久化逻辑
- 新增 `.ralph-loop/history.jsonl` 与 `.ralph-loop/runs/<run-id>.json` 文件结构
- 为后续 `history` / `show` 类只读查看能力提供稳定数据基础
