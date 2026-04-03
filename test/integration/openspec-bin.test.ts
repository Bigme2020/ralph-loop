import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { OPENSPEC_PROMPT_TEMPLATE } from "../../openspec-wrapper";

describe("openspec bin 集成行为", () => {
  it("运行 TypeScript 版本的 OpenSpec bin 入口", async () => {
    const repoRoot = realpathSync(mkdtempSync(join(tmpdir(), "ralph-openspec-direct-")));
    const changeDir = join(repoRoot, "openspec", "changes", "demo-change");
    mkdirSync(join(changeDir, "specs", "demo"), { recursive: true });
    writeFileSync(join(changeDir, "proposal.md"), "# proposal\n", "utf8");
    writeFileSync(join(changeDir, "design.md"), "# design\n", "utf8");
    writeFileSync(join(changeDir, "tasks.md"), "- [x] done\n", "utf8");
    writeFileSync(join(changeDir, "specs", "demo", "spec.md"), "# spec\n", "utf8");

    const proc = Bun.spawn(
      [
        Bun.which("bun")!,
        "run",
        join(process.cwd(), "bin", "ralph-run-openspec.ts"),
        "--change-id",
        "demo-change",
        "--max-iterations",
        "1",
        "--agent",
        "opencode",
        "--",
        join(process.cwd(), "test", "fixtures", "fake-agents", "fake-agent-success.ts"),
      ],
      {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          RALPH_OPENCODE_BINARY: Bun.which("bun")!,
          RALPH_SKIP_GIT_CLEAN_CHECK: "1",
        },
      },
    );

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    try {
      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toContain("== OpenSpec Ralph Run ==");
      expect(stdout).toContain("complete after iteration 1/1");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("通过 ralph-loop CLI 而不是直接调用 core 运行", async () => {
    const repoRoot = realpathSync(mkdtempSync(join(tmpdir(), "ralph-openspec-wrapper-")));
    const globalBinDir = join(repoRoot, "global-bin");
    const changeDir = join(repoRoot, "openspec", "changes", "demo-change");
    mkdirSync(globalBinDir, { recursive: true });
    mkdirSync(join(changeDir, "specs", "demo"), { recursive: true });
    writeFileSync(join(changeDir, "proposal.md"), "# proposal\n", "utf8");
    writeFileSync(join(changeDir, "design.md"), "# design\n", "utf8");
    writeFileSync(join(changeDir, "tasks.md"), "- [x] done\n", "utf8");
    writeFileSync(join(changeDir, "specs", "demo", "spec.md"), "# spec\n", "utf8");
    writeFileSync(
      join(globalBinDir, "ralph-loop"),
      `#!/usr/bin/env bun\nimport { writeFileSync } from "node:fs";\nconst args = process.argv.slice(2);\nwriteFileSync(${JSON.stringify(join(repoRoot, "ralph-loop-call.json"))}, JSON.stringify({ args }, null, 2));\nconsole.log("delegated via global cli");\n`,
      "utf8",
    );
    Bun.spawnSync(["chmod", "+x", join(globalBinDir, "ralph-loop")]);

    const proc = Bun.spawn(
      [
        Bun.which("bun")!,
        "run",
        join(process.cwd(), "bin", "ralph-run-openspec.ts"),
        "--change-id",
        "demo-change",
        "--max-iterations",
        "2",
        "--agent",
        "opencode",
        "--model",
        "demo-model",
        "--",
        "--sandbox",
        "workspace-write",
      ],
      {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PATH: `${globalBinDir}:${process.env.PATH ?? ""}`,
          RALPH_SKIP_GIT_CLEAN_CHECK: "1",
        },
      },
    );

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("delegated via global cli");

    const delegatedCall = JSON.parse(readFileSync(join(repoRoot, "ralph-loop-call.json"), "utf8")) as {
      args: string[];
    };
    expect(delegatedCall.args).toEqual([
      "--agent",
      "opencode",
      OPENSPEC_PROMPT_TEMPLATE,
      "--append-prompt",
      `执行 OpenSpec change：${join(repoRoot, "openspec", "changes", "demo-change")}`,
      "--max-iterations",
      "2",
      "--model",
      "demo-model",
      "--",
      "--sandbox",
      "workspace-write",
    ]);

    rmSync(repoRoot, { recursive: true, force: true });
  });
});
