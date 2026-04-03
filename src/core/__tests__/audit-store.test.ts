import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAuditStore, createRunSummary } from "../audit-store";

describe("audit store 模块", () => {
  it("初始化、追加 iteration 并写入 history 索引", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-audit-"));
    const store = createAuditStore(cwd);
    const runId = store.createRunId();

    store.initialize({
      runId,
      startedAt: "2026-04-03T00:00:00.000Z",
      cwd,
      agent: "opencode",
      model: "anthropic/claude-sonnet-4.5",
      promptSource: "inline",
      promptLength: 5,
      status: "running",
      iterations: [],
    });

    store.appendIteration(runId, {
      iteration: 1,
      exitCode: 0,
      completed: true,
      tools: { read: 1 },
      askedQuestion: false,
      answerProvided: false,
    });

    store.finalize(runId, {
      endedAt: "2026-04-03T00:01:00.000Z",
      status: "completed",
      completedIterations: 1,
      summary: createRunSummary("completed", { iteration: 1 }),
    });

    const detailPath = join(cwd, ".ralph-loop", "runs", `${runId}.json`);
    expect(existsSync(detailPath)).toBeTrue();

    const detail = JSON.parse(readFileSync(detailPath, "utf8")) as Record<string, unknown>;
    expect(detail.status).toBe("completed");
    expect(detail.completedIterations).toBe(1);
    expect(detail.iterations).toEqual([
      {
        iteration: 1,
        exitCode: 0,
        completed: true,
        tools: { read: 1 },
        askedQuestion: false,
        answerProvided: false,
      },
    ]);

    const historyLines = readFileSync(join(cwd, ".ralph-loop", "history.jsonl"), "utf8").trim().split("\n");
    expect(historyLines).toHaveLength(1);
    expect(JSON.parse(historyLines[0]!).summary).toBe("completed after 1 iterations");

    rmSync(cwd, { recursive: true, force: true });
  });

  it("生成可读 runId 和固定 summary 模板", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-audit-"));
    const store = createAuditStore(cwd);
    const runId = store.createRunId();

    expect(runId).toMatch(/^\d{8}T\d{6}Z-[0-9a-f]{6}$/);
    expect(createRunSummary("aborted", { iteration: 2, promise: "ABORT" })).toBe("aborted after 2 iterations via ABORT");
    expect(createRunSummary("timed-out", { iteration: 4 })).toBe("timed out at iteration 4");
    expect(createRunSummary("max-iterations", { iteration: 5, maxIterations: 5 })).toBe("stopped at max iterations 5");
    expect(createRunSummary("crashed", { iteration: 3 })).toBe("crashed during iteration 3");

    rmSync(cwd, { recursive: true, force: true });
  });
});
