import { describe, expect, it, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildOpenSpecPrompt,
  buildRalphLoopArgs,
  findSpecFiles,
  OPENSPEC_PROMPT_TEMPLATE,
  resolveRalphLoopCommand,
  resolveRalphLoopInvocation,
  validateOpenSpecChange,
} from "../index";

describe("openspec wrapper 模块", () => {
  function createOpenSpecChangeFixture(): { repoRoot: string; changeDir: string } {
    const repoRoot = mkdtempSync(join(tmpdir(), "ralph-openspec-unit-"));
    const changeDir = join(repoRoot, "openspec", "changes", "demo-change");
    mkdirSync(join(changeDir, "specs", "demo"), { recursive: true });
    writeFileSync(join(changeDir, "proposal.md"), "# proposal\n", "utf8");
    writeFileSync(join(changeDir, "design.md"), "# design\n", "utf8");
    writeFileSync(join(changeDir, "tasks.md"), "- [ ] todo\n", "utf8");
    writeFileSync(join(changeDir, "specs", "demo", "spec.md"), "# spec\n", "utf8");
    return { repoRoot, changeDir };
  }

  it("根据 change 目录构造运行时 prompt", () => {
    expect(buildOpenSpecPrompt("/tmp/openspec/changes/add-auth")).toBe("执行 OpenSpec change：/tmp/openspec/changes/add-auth");
  });

  it("查找 change 目录下的 spec 文件", () => {
    const { repoRoot, changeDir } = createOpenSpecChangeFixture();

    try {
      const files = findSpecFiles(changeDir);
      expect(files.some((file) => file.endsWith("spec.md"))).toBeTrue();
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("校验完整的 OpenSpec change 目录", () => {
    const { repoRoot, changeDir } = createOpenSpecChangeFixture();

    try {
      expect(() => validateOpenSpecChange(changeDir)).not.toThrow();
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("构造委托给 ralph-loop CLI 的参数", () => {
    expect(
      buildRalphLoopArgs({
        promptText: OPENSPEC_PROMPT_TEMPLATE,
        appendPrompt: "执行 OpenSpec change：/repo/openspec/changes/add-auth",
        agent: "opencode",
        maxIterations: 3,
        model: "claude-sonnet-4",
        extraArgs: ["--sandbox", "workspace-write"],
      }),
    ).toEqual([
      "--agent",
      "opencode",
      OPENSPEC_PROMPT_TEMPLATE,
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

  it("优先解析 PATH 中的全局 ralph-loop 命令", () => {
    expect(resolveRalphLoopCommand("/repo")).toContain("ralph-loop");
  });

  it("内置 OpenSpec prompt 模板包含关键执行约束", () => {
    expect(OPENSPEC_PROMPT_TEMPLATE).toContain("# 执行 OpenSpec 变更");
    expect(OPENSPEC_PROMPT_TEMPLATE).toContain("每一轮只能选择一个未完成且当前可推进的最小任务");
    expect(OPENSPEC_PROMPT_TEMPLATE).toContain("<promise>COMPLETE</promise>");
  });

  it("未安装全局命令时回退到 bun run 本仓库 CLI", () => {
    const originalWhich = Bun.which;
    Bun.which = mock(() => null);

    try {
      expect(resolveRalphLoopInvocation("/repo")).toEqual({
        command: process.execPath,
        args: ["run", join(process.cwd(), "bin", "ralph-loop.ts")],
      });
    } finally {
      Bun.which = originalWhich;
    }
  });
});
