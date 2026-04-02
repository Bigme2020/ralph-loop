import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { opencodeAdapter } from "../../src/agents/opencode";
import { runAgentProcess } from "../../src/core/process-runner";

const fixturesDir = join(process.cwd(), "test", "fixtures", "fake-agents");

describe("process runner 集成行为", () => {
  it("采集 stdout 并返回成功退出码", async () => {
    const result = await runAgentProcess(
      Bun.which("bun")!,
      opencodeAdapter,
      join(fixturesDir, "fake-agent-success.ts"),
      {
        extraFlags: [],
      },
      {
        rawArgsMode: true,
        heartbeatIntervalMs: 10_000,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("<promise>COMPLETE</promise>");
  });

  it("在无活动超时时终止卡住的进程", async () => {
    const result = await runAgentProcess(
      Bun.which("bun")!,
      opencodeAdapter,
      join(fixturesDir, "fake-agent-timeout.ts"),
      {
        extraFlags: [],
      },
      {
        rawArgsMode: true,
        heartbeatIntervalMs: 10,
        inactivityTimeoutMs: 50,
      },
    );

    expect(result.timedOut).toBeTrue();
  });

  it("在传入的 cwd 中运行子进程", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-process-runner-"));
    const result = await runAgentProcess(
      Bun.which("bun")!,
      opencodeAdapter,
      join(fixturesDir, "fake-agent-cwd.ts"),
      {
        extraFlags: [],
      },
      {
        rawArgsMode: true,
        cwd,
        heartbeatIntervalMs: 10_000,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(cwd, "cwd-log.txt"), "utf8")).toBe(realpathSync(cwd));

    rmSync(cwd, { recursive: true, force: true });
  });

  it("在流式输出时汇总工具使用情况", async () => {
    const result = await runAgentProcess(
      Bun.which("bun")!,
      opencodeAdapter,
      join(fixturesDir, "fake-agent-stream.ts"),
      {
        extraFlags: [],
      },
      {
        rawArgsMode: true,
        heartbeatIntervalMs: 10_000,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.toolCounts).toEqual({ read: 1, write: 1 });
  });
});
