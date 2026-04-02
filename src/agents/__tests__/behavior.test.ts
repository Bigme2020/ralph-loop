import { describe, expect, it } from "bun:test";

import { getAgentAdapter } from "../registry";

describe("agent adapter 行为", () => {
  it("将 Claude Code 的 JSON 流输出归一化为展示文本", () => {
    const adapter = getAgentAdapter("claude-code");
    const output = adapter.normalizeOutput(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "第一行" },
            { type: "tool_use", name: "read" },
            { type: "text", text: "第二行" },
          ],
        },
      }),
    );

    expect(output).toBe("第一行\n第二行");
  });

  it("识别 opencode 输出中的 question 工具内容", () => {
    const adapter = getAgentAdapter("opencode");
    const question = adapter.detectQuestion("|  question Should I continue with the migration?");

    expect(question).toContain("Should I continue");
  });

  it("从 opencode 的流式输出行中提取工具名", () => {
    const adapter = getAgentAdapter("opencode");
    expect(adapter.parseToolName("|  read src/index.ts")).toBe("read");
  });
});
