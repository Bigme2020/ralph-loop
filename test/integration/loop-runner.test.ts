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
    expect(existsSync(join(cwd, ".ralph-loop", "active-run.json"))).toBeFalse();

    const historyEntries = readFileSync(join(cwd, ".ralph-loop", "history.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(historyEntries).toHaveLength(1);
    expect(historyEntries[0]?.status).toBe("completed");
    expect(historyEntries[0]?.summary).toBe("completed after 1 iterations");

    const runId = historyEntries[0]?.runId;
    expect(typeof runId).toBe("string");

    const detail = JSON.parse(
      readFileSync(join(cwd, ".ralph-loop", "runs", `${String(runId)}.json`), "utf8"),
    ) as Record<string, unknown>;
    expect(detail.status).toBe("completed");
    expect(detail.promptLength).toBe(5);
    expect(detail.completedIterations).toBe(1);
    expect(detail.summary).toBe("completed after 1 iterations");
    expect(detail.iterations).toEqual([
      {
        iteration: 1,
        exitCode: 0,
        completed: true,
        tools: {},
        askedQuestion: false,
        answerProvided: false,
      },
    ]);

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

  it("记录提问元信息但不落用户回答正文", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
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

    expect(result.status).toBe("completed");

    const historyEntries = readFileSync(join(cwd, ".ralph-loop", "history.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const runId = historyEntries[0]?.runId;
    const detail = JSON.parse(
      readFileSync(join(cwd, ".ralph-loop", "runs", `${String(runId)}.json`), "utf8"),
    ) as Record<string, unknown>;

    expect(detail.promptLength).toBe(4);
    expect(JSON.stringify(detail)).not.toContain("请继续执行");
    expect(detail.iterations).toEqual([
      {
        iteration: 1,
        exitCode: 0,
        completed: false,
        tools: { question: 1 },
        askedQuestion: true,
        answerProvided: true,
        answerLength: 5,
      },
      {
        iteration: 2,
        exitCode: 0,
        completed: true,
        tools: {},
        askedQuestion: false,
        answerProvided: false,
      },
    ]);

    rmSync(cwd, { recursive: true, force: true });
  });

  it("在 agent 崩溃时保留 crashed 详情记录", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-run-"));
    let error: Error | undefined;

    try {
      await runLoop({
        cwd,
        agent: {
          type: "opencode",
          commandOverride: bunBinary,
          extraFlags: [join(fixturesDir, "fake-agent-question.ts"), join(cwd, "prompt-log.txt")],
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
        interaction: {
          onQuestion: async () => {
            throw new Error("answer pipeline failed");
          },
        },
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).toBeDefined();
    expect(existsSync(join(cwd, ".ralph-loop", "active-run.json"))).toBeFalse();

    const historyEntries = readFileSync(join(cwd, ".ralph-loop", "history.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(historyEntries).toHaveLength(1);
    expect(historyEntries[0]?.status).toBe("crashed");

    const runId = historyEntries[0]?.runId;
    const detail = JSON.parse(
      readFileSync(join(cwd, ".ralph-loop", "runs", `${String(runId)}.json`), "utf8"),
    ) as Record<string, unknown>;
    expect(detail.status).toBe("crashed");
    expect(detail.summary).toBe("crashed during iteration 1");
    expect(detail.completedIterations).toBe(0);
    expect(detail.iterations).toEqual([]);

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
