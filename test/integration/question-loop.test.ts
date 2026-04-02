import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createStateStore } from "../../src/core/state-store";
import { runLoop } from "../../src/core/loop-runner";

const bunBinary = Bun.which("bun")!;
const fixturesDir = join(process.cwd(), "test", "fixtures", "fake-agents");

describe("question 处理集成行为", () => {
  it("将回答注入下一轮迭代的 prompt", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-question-"));
    const promptLog = join(cwd, "prompt-log.txt");
    const result = await runLoop({
      cwd,
      agent: {
        type: "opencode",
        commandOverride: bunBinary,
        extraFlags: [join(fixturesDir, "fake-agent-question.ts"), promptLog],
      },
      prompt: {
        text: "原始任务",
      },
      completion: {
        success: "COMPLETE",
        maxIterations: 2,
      },
      runtime: {
        iterationDelayMs: 1,
        heartbeatIntervalMs: 10_000,
      },
      interaction: {
        onQuestion: async () => "请继续执行",
      },
    });

    const logged = readFileSync(promptLog, "utf8");
    expect(result.status).toBe("completed");
    expect(logged).toContain("## 上一轮交互回答");
    expect(logged).toContain("请继续执行");

    rmSync(cwd, { recursive: true, force: true });
  });

  it("在完成后清理 active state", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-question-"));
    const result = await runLoop({
      cwd,
      agent: {
        type: "opencode",
        commandOverride: bunBinary,
        extraFlags: [join(fixturesDir, "fake-agent-success.ts")],
      },
      prompt: {
        text: "hello",
      },
      completion: {
        success: "COMPLETE",
        maxIterations: 1,
      },
    });

    const store = createStateStore(cwd);
    expect(result.status).toBe("completed");
    expect(store.load()).toBeNull();

    rmSync(cwd, { recursive: true, force: true });
  });
});
