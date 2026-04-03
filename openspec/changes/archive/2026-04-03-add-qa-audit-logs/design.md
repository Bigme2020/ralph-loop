## Context

当前 `ralph-loop-core` 在 `.ralph-loop/` 下只保留 `active-run.json`，职责集中在
resume 和 cleanup。这个设计对运行控制足够，但对 QA 回看几乎没有帮助，因为大
多数终态执行结束后目录里只剩一个空壳，无法回答“这次 run 什么时候开始、用了
哪个 agent、执行了几轮、为什么结束、每轮是否发生提问”这类基础问题。

这次变更的约束也很明确：日志要优先服务 QA，而不是把 `.ralph-loop/` 变成调试
转储目录。也就是说，记录必须足够简洁、结构稳定、可快速扫读，同时默认不能把
完整 prompt、agent 输出和用户回答正文落盘，避免体积膨胀和敏感信息扩散。

## Goals / Non-Goals

**Goals:**

- 让 `.ralph-loop/` 在保留 `active-run` 能力的同时，承载最小可回溯的 QA 审计记录
- 将日志分为“历史摘要索引”和“单次运行详情”两层，兼顾快速浏览和单次回看
- 保持 iteration 摘要极简，只记录 QA 判断运行行为所需字段
- 在 loop 主流程异常时仍尽量保留一条可追溯的 `crashed` 记录

**Non-Goals:**

- 不提供 `history`、`show` 等新的 CLI 查看命令
- 不默认记录 stdout/stderr、完整 prompt、用户回答正文或其他调试正文
- 不引入日志清理、轮转或 retention 策略
- 不改变现有 `active-run.json` 的 resume 职责和语义

## Decisions

### 1. 采用双层日志结构，而不是单一历史文件

设计选择：在 `.ralph-loop/` 下同时保留 `history.jsonl` 和 `runs/<run-id>.json`。

原因：单一 `jsonl` 文件虽然实现更轻，但一旦后续需要补充 run 级详情、增加终态
元信息，历史文件会快速膨胀。双层结构把“快速总览”和“详情回看”拆开，既方便
后续 grep，也为将来的只读查看能力提供稳定基础。

备选方案：只保留 `runs.jsonl`。没有采用，因为它会把摘要和详情耦合在一起，后续
扩展时更容易破坏可读性。

### 2. detail 运行中更新，history 只在终态追加

设计选择：run 启动时初始化 `runs/<run-id>.json` 为 `running`，每轮结束后持续更新
detail；进入终态后先写 detail 的最终状态，再向 `history.jsonl` 追加摘要。

原因：这是最稳妥的写入顺序。它既能在运行中保留现场，也能避免出现 “history
已有索引，但详情文件缺失或未完成” 的不一致状态。

备选方案：只在 run 结束时一次性写 detail。没有采用，因为主流程异常时会更容易
丢失中间现场。

### 3. 保持 QA 视角下的最小字段集

设计选择：run 级记录只保留 `runId`、时间、cwd、agent、model、promptSource、
`promptLength`、`status`、`completedIterations`、`summary`。iteration 级只保留
`iteration`、`exitCode`、`completed`、`tools`、`askedQuestion`、`answerProvided`，
并仅在有回答时记录 `answerLength`。

原因：QA 关心的是“发生了什么”，而不是“原文是什么”。长度和布尔标记足够支持
审计，且能显著降低日志噪音和敏感信息落盘风险。

备选方案：记录完整 prompt、stdout/stderr 或回答正文。没有采用，因为这会把 QA
日志退化成调试日志，并显著增加体积和泄露面。

### 4. 为异常流程引入 `crashed` 终态

设计选择：将 loop 主流程中的未处理异常单独归档为 `crashed`，并仍然写入 detail
和 history。

原因：对 QA 来说，“没有记录”比“多一个异常状态”更糟。`crashed` 让异常 run 在
历史中可见，同时和 `completed`、`aborted`、`timed-out`、`cancelled`、
`max-iterations` 区分开来。

备选方案：异常直接抛出，不落任何日志。没有采用，因为这会让问题 run 从审计视角
彻底消失。

## Risks / Trade-offs

- [日志文件持续增长] → 第一版接受“全部保留”，先保证记录稳定；后续若需要再单独增加 retention 变更
- [detail 与 history 写入分两步，仍可能在极端崩溃中只留下 detail] → 明确采用“先 detail、后 history”，优先保证单次 run 现场可回看
- [`tools` 字段会把 question/tool 解析结果一起计入摘要] → 保持与现有工具统计逻辑一致，避免为日志单独维护另一套解释规则
- [异常 `crashed` 只覆盖 loop 主流程异常，不等于 agent 非零退出] → 在文档中明确区分，避免把运行失败和框架异常混为一谈

## Migration Plan

1. 新增独立的审计存储模块，负责 `runId`、detail、history 的文件布局和终态摘要格式。
2. 在 `loop-runner` 中接入审计存储，并在 run 启动、每轮结束、终态退出和异常路径上更新日志。
3. 保持 `state-store` 只负责 `active-run.json`，避免 QA 日志和 resume 状态耦合。
4. 通过单元测试和集成测试验证完成态、提问态和异常态的落盘行为。

这次变更不涉及部署或数据迁移，回滚时只需移除新的 audit 写入逻辑，已有 `.ralph-loop`
目录中的历史日志不会影响 resume 能力。

## Open Questions

- 是否需要在后续变更中补一个只读查看命令，例如 `ralph-loop history`
- 是否需要在未来加入日志保留策略，例如“只保留最近 N 次 run”
- 是否需要为 `crashed` 记录增加更显式的错误分类字段，而不只是终态摘要
