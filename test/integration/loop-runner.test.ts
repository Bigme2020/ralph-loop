import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runLoop } from "../../src/core/loop-runner";

const bunBinary = Bun.which("bun")!;
const fixturesDir = join(process.cwd(), "test", "fixtures", "fake-agents");

describe("loop runner 集成行为", () => {
  it("在输出成功 promise 时完成运行", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
    rmSync(join(process.cwd(), "cwd-log.txt"), { force: true });
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
        maxIterations: 2,
      },
      runtime: {
        iterationDelayMs: 1,
        heartbeatIntervalMs: 10_000,
      },
    });

    expect(result.status).toBe("completed");
    expect(result.completedIterations).toBe(1);

    rmSync(cwd, { recursive: true, force: true });
  });

  it("在非零退出后持续重试直到达到最大迭代次数", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
    const result = await runLoop({
      cwd,
      agent: {
        type: "opencode",
        commandOverride: bunBinary,
        extraFlags: [join(fixturesDir, "fake-agent-fail.ts")],
      },
      prompt: {
        text: "hello",
      },
      completion: {
        success: "COMPLETE",
        maxIterations: 2,
      },
      runtime: {
        iterationDelayMs: 1,
        heartbeatIntervalMs: 10_000,
      },
    });

    expect(result.status).toBe("max-iterations");
    expect(result.completedIterations).toBe(2);

    rmSync(cwd, { recursive: true, force: true });
  });

  it("将 loop 的 cwd 传递给启动的 agent 进程", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
    const result = await runLoop({
      cwd,
      agent: {
        type: "opencode",
        commandOverride: bunBinary,
        extraFlags: [join(fixturesDir, "fake-agent-cwd.ts")],
      },
      prompt: {
        text: "hello",
      },
      completion: {
        success: "COMPLETE",
        maxIterations: 1,
      },
      runtime: {
        heartbeatIntervalMs: 10_000,
      },
    });

    expect(result.status).toBe("completed");
    expect(existsSync(join(process.cwd(), "cwd-log.txt"))).toBeFalse();
    expect(readFileSync(join(cwd, "cwd-log.txt"), "utf8")).toBe(realpathSync(cwd));

    rmSync(cwd, { recursive: true, force: true });
  });

  it("在达到无活动超时时立即返回超时结果", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
    const result = await runLoop({
      cwd,
      agent: {
        type: "opencode",
        commandOverride: bunBinary,
        extraFlags: [join(fixturesDir, "fake-agent-timeout.ts")],
      },
      prompt: {
        text: "hello",
      },
      completion: {
        success: "COMPLETE",
      },
      runtime: {
        heartbeatIntervalMs: 10,
        inactivityTimeoutMs: 50,
        iterationDelayMs: 1,
      },
    });

    expect(result.status).toBe("timed-out");
    expect(result.completedIterations).toBe(1);

    rmSync(cwd, { recursive: true, force: true });
  }, 2_000);

  it("在超时时通过 reporter 提示 resume 命令", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
    const timeoutEvents: Array<{ idleMs: number; timeoutMs: number; resumeHint?: string }> = [];

    const result = await runLoop({
      cwd,
      agent: {
        type: "opencode",
        commandOverride: bunBinary,
        extraFlags: [join(fixturesDir, "fake-agent-timeout.ts")],
      },
      prompt: {
        text: "hello",
      },
      completion: {
        success: "COMPLETE",
      },
      runtime: {
        heartbeatIntervalMs: 10,
        inactivityTimeoutMs: 50,
        iterationDelayMs: 1,
      },
      reporter: {
        onTimeout(context) {
          timeoutEvents.push(context);
        },
      },
    });

    expect(result.status).toBe("timed-out");
    expect(timeoutEvents).toHaveLength(1);
    expect(timeoutEvents[0]?.resumeHint).toContain("--resume");

    rmSync(cwd, { recursive: true, force: true });
  }, 2_000);

  it("在输出 abort promise 时返回 aborted 并清理状态", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
    const result = await runLoop({
      cwd,
      agent: {
        type: "opencode",
        commandOverride: bunBinary,
        extraFlags: [join(fixturesDir, "fake-agent-abort.ts")],
      },
      prompt: {
        text: "hello",
      },
      completion: {
        success: "COMPLETE",
        abort: "ABORT",
        maxIterations: 2,
      },
      runtime: {
        heartbeatIntervalMs: 10_000,
      },
    });

    expect(result.status).toBe("aborted");
    expect(existsSync(join(cwd, ".ralph-loop", "active-run.json"))).toBeFalse();

    rmSync(cwd, { recursive: true, force: true });
  });

  it("在收到取消信号时返回 cancelled 并清理状态", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);

    const result = await runLoop({
      cwd,
      agent: {
        type: "opencode",
        commandOverride: bunBinary,
        extraFlags: [join(fixturesDir, "fake-agent-timeout.ts")],
      },
      prompt: {
        text: "hello",
      },
      completion: {
        success: "COMPLETE",
      },
      runtime: {
        heartbeatIntervalMs: 10,
        cancelSignal: controller.signal,
      },
    });

    expect(result.status).toBe("cancelled");
    expect(existsSync(join(cwd, ".ralph-loop", "active-run.json"))).toBeFalse();

    rmSync(cwd, { recursive: true, force: true });
  }, 2_000);
});
