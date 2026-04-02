import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createStateStore } from "../state-store";
import type { LoopState } from "../types";

function createState(): LoopState {
  return {
    active: true,
    iteration: 2,
    agent: "opencode",
    model: "anthropic/claude-sonnet-4.5",
    prompt: { text: "hello" },
    completion: { success: "COMPLETE", maxIterations: 5 },
    runtime: {},
    startedAt: "2026-03-29T00:00:00.000Z",
  };
}

describe("state store 模块", () => {
  it("保存并重新读取 loop 状态", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-state-"));
    const store = createStateStore(cwd);
    const state = createState();

    store.save(state);
    expect(store.load()).toEqual(state);

    rmSync(cwd, { recursive: true, force: true });
  });

  it("清理 active state 文件", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-state-"));
    const store = createStateStore(cwd);

    store.save(createState());
    store.clear();

    expect(existsSync(store.statePath)).toBeFalse();

    rmSync(cwd, { recursive: true, force: true });
  });

  it("在状态文件损坏时返回 null", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-state-"));
    const store = createStateStore(cwd);

    store.save(createState());
    writeFileSync(store.statePath, "{bad json", "utf8");

    expect(store.load()).toBeNull();

    rmSync(cwd, { recursive: true, force: true });
  });

  it("支持自定义状态目录名称", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-state-"));
    const store = createStateStore(cwd, ".custom-state");

    store.save(createState());

    expect(store.stateDir).toBe(join(cwd, ".custom-state"));
    expect(readFileSync(store.statePath, "utf8")).toContain('"iteration": 2');

    rmSync(cwd, { recursive: true, force: true });
  });
});
