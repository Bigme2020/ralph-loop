## 1. 审计存储建模

- [x] 1.1 新增独立的审计存储模块，定义 `history.jsonl` 和 `runs/<run-id>.json` 的文件结构
- [x] 1.2 实现 `runId`、detail 初始化、iteration 追加和终态 summary 生成逻辑

## 2. Loop 运行时接线

- [x] 2.1 在 `loop-runner` 启动时初始化 run 详情记录，并保留现有 `active-run.json` 行为
- [x] 2.2 在每轮迭代结束后写入极简 iteration 摘要，不落盘 prompt、输出或回答正文
- [x] 2.3 在 completed、aborted、timed-out、cancelled、max-iterations 终态时先固化 detail，再追加 history 摘要
- [x] 2.4 在 loop 主流程异常时补写 `crashed` 详情和 history 记录

## 3. 验证与文档

- [x] 3.1 新增或更新测试，覆盖完成态、提问元信息和异常 `crashed` 日志场景
- [x] 3.2 确认现有 resume、question 和 CLI 集成行为未被审计日志改动破坏
- [x] 3.3 用 OpenSpec proposal、delta spec、design 和 tasks 记录 QA 审计日志能力
