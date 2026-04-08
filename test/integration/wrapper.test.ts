import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("OpenSpec wrapper 集成行为", () => {
  it("在双横线之后透传额外的 agent 参数", async () => {
    const repoRoot = join(tmpdir(), `ralph-wrapper-${Date.now()}`);
    const changeDir = join(repoRoot, "openspec", "changes", "test-change");
    mkdirSync(join(changeDir, "specs", "ralph-loop-core"), { recursive: true });
    writeFileSync(join(changeDir, "proposal.md"), "# proposal\n", "utf8");
    writeFileSync(join(changeDir, "design.md"), "# design\n", "utf8");
    writeFileSync(join(changeDir, "tasks.md"), "- [ ] task\n", "utf8");
    writeFileSync(join(changeDir, "specs", "ralph-loop-core", "spec.md"), "# spec\n", "utf8");

    const proc = Bun.spawn(
      [
        Bun.which("bun")!,
        "run",
        join(process.cwd(), "bin", "ralph-run-openspec.ts"),
        "--change-id",
        "test-change",
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

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("== Ralph Loop ==");
    expect(stdout).toContain("complete after iteration 1/1");
  });
});
