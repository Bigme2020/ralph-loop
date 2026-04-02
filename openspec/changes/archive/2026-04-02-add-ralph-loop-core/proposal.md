# 提案：add-ralph-loop-core

## Why

`ralph-run-openspec.sh` 当前将循环执行委托给 `open-ralph-wiggum`，但本仓库
实际只依赖其中很小的一部分能力：重复执行 agent、读取外部 prompt、识别
完成信号，以及处理基础循环边界。

当前工作流比上游工具更定制，核心是围绕 OpenSpec 文档配合 OpenCode 做
迭代，不需要 tasks mode、历史面板、rotation、auto-commit 等产品层能力。
继续依赖完整运行时会带来不必要的耦合，也会降低仓库后续定制演进的灵活性。

## What Changes

- 新增一个基于 Bun 的仓库内 `ralph-loop-core`，作为可复用的最小运行时
- 新增一个保留运行时迭代 CLI 体验的薄 `ralph-loop` CLI
- 继续兼容 `opencode`、`claude-code`、`codex` 和 `copilot`
- 将 OpenSpec 专属校验和运行时 prompt 组装下沉到基于新 loop core 的薄
  wrapper

## 不在范围内

- tasks mode
- 状态面板与历史分析
- auto-commit
- agent rotation
- 在 loop core 中硬编码 OpenSpec 规则
- 第一版实现中的 prompt template DSL

## 预期影响

仓库将拥有一套真正符合自身需求的最小 loop 运行时，同时保留现有的 OpenSpec
工作流入口。这会减少依赖面，提升后续定制能力，并让 core 继续可复用到其他
文档驱动的 wrapper 中。
