import { describe, expect, it } from "bun:test";

import { createConsoleReporter } from "../console-reporter";

describe("console reporter 模块", () => {
  it("在超时时输出 resume 提示", () => {
    const reporter = createConsoleReporter();
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };

    try {
      reporter.onTimeout?.({
        iteration: 2,
        maxIterations: 5,
        idleMs: 50,
        timeoutMs: 50,
        resumeHint: "cd /repo && bun run bin/ralph-loop.ts --resume",
      });
    } finally {
      console.log = originalLog;
    }

    expect(lines.some((line) => line.includes("timeout after iteration 2/5"))).toBeTrue();
    expect(lines.some((line) => line.includes("--resume"))).toBeTrue();
  });
});
