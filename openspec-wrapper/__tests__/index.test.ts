import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildOpenSpecPrompt, buildRalphLoopArgs, findSpecFiles, validateOpenSpecChange } from "../index";

describe("openspec wrapper 模块", () => {
  it("根据 change 目录构造运行时 prompt", () => {
    expect(buildOpenSpecPrompt("/tmp/openspec/changes/add-auth")).toBe("执行 OpenSpec change：/tmp/openspec/changes/add-auth");
  });

  it("查找 change 目录下的 spec 文件", () => {
    const repoRoot = process.cwd();
    const changeDir = join(repoRoot, "openspec", "changes", "add-ralph-loop-core");
    const files = findSpecFiles(changeDir);

    expect(files.some((file) => file.endsWith("spec.md"))).toBeTrue();
  });

  it("校验完整的 OpenSpec change 目录", () => {
    const repoRoot = process.cwd();
    const changeDir = join(repoRoot, "openspec", "changes", "add-ralph-loop-core");

    expect(() => validateOpenSpecChange(changeDir)).not.toThrow();
  });

  it("构造委托给 ralph-loop CLI 的参数", () => {
    expect(
      buildRalphLoopArgs({
        repoRoot: "/repo",
        promptFile: "/repo/openspec-wrapper/openspec-prompt-file.md",
        appendPrompt: "执行 OpenSpec change：/repo/openspec/changes/add-auth",
        agent: "opencode",
        maxIterations: 3,
        model: "claude-sonnet-4",
        extraArgs: ["--sandbox", "workspace-write"],
      }),
    ).toEqual([
      "run",
      "/repo/bin/ralph-loop.ts",
      "--agent",
      "opencode",
      "--prompt-file",
      "/repo/openspec-wrapper/openspec-prompt-file.md",
      "--append-prompt",
      "执行 OpenSpec change：/repo/openspec/changes/add-auth",
      "--max-iterations",
      "3",
      "--model",
      "claude-sonnet-4",
      "--",
      "--sandbox",
      "workspace-write",
    ]);
  });
});
