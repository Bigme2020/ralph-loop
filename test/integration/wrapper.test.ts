import { describe, expect, it } from "bun:test";
import { join } from "node:path";

describe("OpenSpec wrapper 集成行为", () => {
  it("在双横线之后透传额外的 agent 参数", async () => {
    const proc = Bun.spawn(
      [
        Bun.which("bun")!,
        "run",
        join(process.cwd(), "bin", "ralph-run-openspec.ts"),
        "--change-id",
        "add-ralph-loop-core",
        "--max-iterations",
        "1",
        "--agent",
        "opencode",
        "--",
        join(process.cwd(), "test", "fixtures", "fake-agents", "fake-agent-success.ts"),
      ],
      {
        cwd: process.cwd(),
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
