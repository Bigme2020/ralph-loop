import { describe, expect, it } from "bun:test";

import { appendAnswerContext } from "../question-flow";

describe("question flow 模块", () => {
  it("在回答存在时追加上一轮交互回答区块", () => {
    expect(appendAnswerContext("base prompt", "需要先跑测试")).toContain("## 上一轮交互回答");
  });

  it("在回答为空白时保持 prompt 不变", () => {
    expect(appendAnswerContext("base prompt", "   ")).toBe("base prompt");
  });
});
