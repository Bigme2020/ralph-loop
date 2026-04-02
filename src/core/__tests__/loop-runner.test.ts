import { describe, expect, it } from "bun:test";

import { buildResumeHint, createInitialState, resolvePromptForIteration } from "../loop-runner";
import type { LoopOptions } from "../types";

function createOptions(overrides: Partial<LoopOptions> = {}): LoopOptions {
  return {
    cwd: "/repo",
    agent: {
      type: "opencode",
      model: "test-model",
    },
    prompt: {
      text: "base prompt",
    },
    completion: {
      success: "COMPLETE",
      maxIterations: 3,
    },
    ...overrides,
  };
}

describe("loop runner 辅助函数", () => {
  it("根据 options 创建初始 loop 状态", () => {
    const state = createInitialState(createOptions());

    expect(state.active).toBeTrue();
    expect(state.iteration).toBe(1);
    expect(state.agent).toBe("opencode");
    expect(state.model).toBe("test-model");
    expect(state.prompt).toEqual({ text: "base prompt" });
    expect(state.completion).toEqual({ success: "COMPLETE", maxIterations: 3 });
    expect(state.runtime).toEqual({});
    expect(new Date(state.startedAt).toString()).not.toBe("Invalid Date");
  });

  it("在初始状态中保留传入的 runtime 配置", () => {
    const state = createInitialState(
      createOptions({
        runtime: {
          heartbeatIntervalMs: 5000,
          iterationDelayMs: 10,
        },
      }),
    );

    expect(state.runtime).toEqual({
      heartbeatIntervalMs: 5000,
      iterationDelayMs: 10,
    });
  });

  it("为当前迭代解析 prompt 文本", () => {
    const state = createInitialState(
      createOptions({
        prompt: {
          text: "base prompt",
          append: "follow-up",
        },
      }),
    );

    expect(resolvePromptForIteration(state)).toBe("base prompt\n\nfollow-up");
  });

  it("构造 resume 提示命令", () => {
    expect(buildResumeHint("/repo")).toBe("cd /repo && bun run bin/ralph-loop.ts --resume");
  });
});
