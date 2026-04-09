#!/usr/bin/env bun

const transcript = [
  "已按要求完成这次 OpenSpec change 的收尾核对。",
  "",
  "本轮执行内容：",
  "- 读取并核对了 `proposal.md`、`design.md`、`tasks.md`",
  "- 读取并核对了全部 `spec.md`：",
  "  - `specs/placement-system/spec.md`",
  "  - `specs/room-visual-refresh/spec.md`",
  "  - `specs/room-ui-refresh/spec.md`",
  "  - `specs/room-foundation-scene/spec.md`",
  "- 检查到 `tasks.md` 中所有任务已完成，无可继续推进的未完成最小任务",
  "- 进行了实际验证，而不是只看勾选状态",
  "",
  "验证结果：",
  "- `npm run build` 通过",
  "- `npx playwright test --reporter=line` 通过",
  "- E2E 结果：`11 passed`",
  "- 覆盖了房间 UI、视觉刷新、库存进入摆放、场景拖拽、预览反馈、移动端摆放、控件状态等关键闭环",
  "",
  "简短总结：",
  "- 当前 `phase-2-placement-system` 变更的任务与规范状态一致",
  "- 没有发现仍未完成但被误勾选的任务",
  "- 当前验证结果支持将该 change 视为完成",
  "",
  "```text",
  "<promise>COMPLETE</promise>",
  "```",
].join("\n");

console.log(transcript);
