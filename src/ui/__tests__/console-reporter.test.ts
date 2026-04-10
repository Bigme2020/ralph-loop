import { describe, expect, it } from "bun:test";

import { createConsoleReporter } from "../console-reporter";

describe("console reporter 模块", () => {
  it("在超时时输出 resume 提示", () => {
    const lines: string[] = [];
    const reporter = createConsoleReporter({
      stdout: {
        write(chunk: string) {
          lines.push(chunk);
          return true;
        },
      },
    });

    reporter.onTimeout?.({
      iteration: 2,
      maxIterations: 5,
      idleMs: 50,
      timeoutMs: 50,
      resumeHint: "cd /repo && bun run bin/ralph-loop.ts --resume",
    });

    expect(lines.some((line) => line.includes("timeout after iteration 2/5"))).toBeTrue();
    expect(lines.some((line) => line.includes("--resume"))).toBeTrue();
  });

  it("按 core、stdout、stderr 使用不同颜色输出", () => {
    const writes = {
      stdout: [] as string[],
      stderr: [] as string[],
    };
    const reporter = createConsoleReporter({
      forceColor: true,
      colors: {
        core: "cyan",
        agentStdout: "green",
        agentStderr: "yellow",
      },
      stdout: {
        write(chunk: string) {
          writes.stdout.push(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string) {
          writes.stderr.push(chunk);
          return true;
        },
      },
    });

    reporter.onRunStart?.({ agent: "opencode", promptSource: "inline" });
    reporter.onStdoutChunk?.("agent ok\n");
    reporter.onStderrChunk?.("agent warn\n");

    expect(writes.stdout.some((chunk) => chunk.includes("\u001b[36m== Ralph Loop ==\u001b[0m"))).toBeTrue();
    expect(writes.stdout).toContain("\u001b[32magent ok\n\u001b[0m");
    expect(writes.stderr).toContain("\u001b[33magent warn\n\u001b[0m");
  });

  it("在启动摘要中输出模型和推理等级", () => {
    const lines: string[] = [];
    const reporter = createConsoleReporter({
      stdout: {
        write(chunk: string) {
          lines.push(chunk);
          return true;
        },
      },
    });

    reporter.onRunStart?.({
      agent: "opencode",
      model: "claude-sonnet-4.5",
      reasoningLevel: "high",
      promptSource: "inline",
    });

    expect(lines.some((line) => line.includes("模型: claude-sonnet-4.5"))).toBeTrue();
    expect(lines.some((line) => line.includes("推理等级: high"))).toBeTrue();
  });

  it("在 signal 被 minIterations 延迟时输出提示", () => {
    const lines: string[] = [];
    const reporter = createConsoleReporter({
      stdout: {
        write(chunk: string) {
          lines.push(chunk);
          return true;
        },
      },
    });

    reporter.onSignalDeferred?.({
      iteration: 1,
      maxIterations: 3,
      minIterations: 2,
      promise: "COMPLETE",
    });

    expect(lines.some((line) => line.includes("signal COMPLETE detected at iteration 1/3 but deferred until minIterations=2"))).toBeTrue();
  });
});
