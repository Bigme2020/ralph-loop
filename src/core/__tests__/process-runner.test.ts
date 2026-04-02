import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { runAgentProcess } from "../process-runner";
import type { AgentAdapter } from "../../agents/types";

const fixturesDir = join(process.cwd(), "test", "fixtures", "fake-agents");

const envAwareAdapter: AgentAdapter = {
  type: "opencode",
  binaryName: "bun",
  buildArgs(prompt) {
    return [join(fixturesDir, "fake-agent-env.ts"), prompt];
  },
  buildEnv() {
    return { RALPH_TEST_ENV: "yes" };
  },
  parseToolName() {
    return null;
  },
  normalizeOutput(output) {
    return output;
  },
  detectQuestion() {
    return null;
  },
};

const timeoutAdapter: AgentAdapter = {
  type: "opencode",
  binaryName: "bun",
  buildArgs() {
    return [join(fixturesDir, "fake-agent-timeout.ts")];
  },
  parseToolName() {
    return null;
  },
  normalizeOutput(output) {
    return output;
  },
  detectQuestion() {
    return null;
  },
};

const streamAdapter: AgentAdapter = {
  type: "opencode",
  binaryName: "bun",
  buildArgs() {
    return [join(fixturesDir, "fake-agent-stream.ts")];
  },
  parseToolName(line) {
    const match = line.match(/^\|\s{2}([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  },
  normalizeOutput(output) {
    return output;
  },
  detectQuestion() {
    return null;
  },
};

describe("process runner 模块", () => {
  it("在非 rawArgsMode 下使用 adapter 构造参数并合并环境变量", async () => {
    const result = await runAgentProcess(Bun.which("bun")!, envAwareAdapter, "测试提示词", {}, {
      heartbeatIntervalMs: 10_000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("env:yes");
    expect(result.stdout).toContain("prompt:测试提示词");
  });

  it("在超时前持续触发 heartbeat 回调", async () => {
    const heartbeats: Array<{ elapsedMs: number; idleMs: number }> = [];

    const result = await runAgentProcess(Bun.which("bun")!, timeoutAdapter, "ignored", {}, {
      heartbeatIntervalMs: 10,
      inactivityTimeoutMs: 50,
      onHeartbeat(context) {
        heartbeats.push(context);
      },
    });

    expect(result.timedOut).toBeTrue();
    expect(heartbeats.length).toBeGreaterThan(0);
    expect(heartbeats.some((context) => context.idleMs >= 0)).toBeTrue();
  });

  it("在开启流式输出时转发 stdout 与 stderr 分块", async () => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    const result = await runAgentProcess(Bun.which("bun")!, streamAdapter, "ignored", { extraFlags: [] }, {
      heartbeatIntervalMs: 10_000,
      onStdoutChunk(chunk) {
        stdoutChunks.push(chunk);
      },
      onStderrChunk(chunk) {
        stderrChunks.push(chunk);
      },
    });

    expect(result.exitCode).toBe(0);
    expect(stdoutChunks.length).toBeGreaterThan(0);
    expect(stderrChunks.join(" ")).toContain("stderr 输出");
  });

  it("汇总解析到的工具使用情况", async () => {
    const result = await runAgentProcess(Bun.which("bun")!, streamAdapter, "ignored", { extraFlags: [] }, {
      heartbeatIntervalMs: 10_000,
    });

    expect(result.toolCounts).toEqual({
      read: 1,
      write: 1,
    });
  });
});
