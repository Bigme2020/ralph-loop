import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("cli 集成行为", () => {
  it("运行精简 CLI 并打印 reporter 输出", async () => {
    const promptPath = join(tmpdir(), `ralph-loop-cli-${Date.now()}.md`);
    writeFileSync(promptPath, "执行测试任务", "utf8");

    const bunBinary = process.execPath;
    const proc = Bun.spawn(
      [
        bunBinary,
        "run",
        join(process.cwd(), "bin", "ralph-loop.ts"),
        "--agent",
        "opencode",
        "--prompt-file",
        promptPath,
        "--completion-promise",
        "COMPLETE",
        "--max-iterations",
        "1",
        "--",
        join(process.cwd(), "test", "fixtures", "fake-agents", "fake-agent-success.ts"),
      ],
      {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          RALPH_OPENCODE_BINARY: bunBinary,
        },
      },
    );

    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    expect(stdout).toContain("== Ralph Loop ==");
    expect(stdout).toContain("-- Iteration 1/1 --");
  });

  it("在指定 --resume 时恢复未完成运行", async () => {
    const cwd = join(tmpdir(), `ralph-loop-resume-${Date.now()}`);
    const bunBinary = process.execPath;
    mkdirSync(join(cwd, ".ralph-loop"), { recursive: true });
    writeFileSync(
      join(cwd, ".ralph-loop", "active-run.json"),
      `${JSON.stringify({
        active: true,
        iteration: 2,
        agent: "opencode",
        prompt: { text: join(process.cwd(), "test", "fixtures", "fake-agents", "fake-agent-success.ts") },
        completion: { success: "COMPLETE", maxIterations: 3, minIterations: 2 },
        runtime: {},
        startedAt: new Date().toISOString(),
      })}\n`,
      "utf8",
    );

    const proc = Bun.spawn(
      [
        bunBinary,
        "run",
        join(process.cwd(), "bin", "ralph-loop.ts"),
        "--resume",
        "--",
        join(process.cwd(), "test", "fixtures", "fake-agents", "fake-agent-success.ts"),
      ],
      {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          RALPH_OPENCODE_BINARY: bunBinary,
        },
      },
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Iteration 2/3");
  });

  it("在收到 SIGINT 时通过 CLI 取消运行", async () => {
    const cwd = join(tmpdir(), `ralph-loop-sigint-${Date.now()}`);
    const bunBinary = process.execPath;
    mkdirSync(cwd, { recursive: true });
    const proc = Bun.spawn(
      [
        bunBinary,
        "run",
        join(process.cwd(), "bin", "ralph-loop.ts"),
        "--agent",
        "opencode",
        "--completion-promise",
        "COMPLETE",
        "hello",
        "--",
        join(process.cwd(), "test", "fixtures", "fake-agents", "fake-agent-timeout.ts"),
      ],
      {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          RALPH_OPENCODE_BINARY: bunBinary,
        },
      },
    );

    setTimeout(() => {
      proc.kill("SIGINT");
    }, 50);

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(130);
    expect(stdout).toContain("cancelled after iteration 1");
  }, 2_000);

  it("从项目配置读取 CLI 配色", async () => {
    const cwd = join(tmpdir(), `ralph-loop-colors-${Date.now()}`);
    const promptPath = join(cwd, "prompt.md");
    const bunBinary = process.execPath;
    mkdirSync(join(cwd, ".ralph-loop"), { recursive: true });
    writeFileSync(
      join(cwd, ".ralph-loop", "config.jsonc"),
      `{
        "colors": {
          "core": "magenta",
          "agentStdout": "green",
          "agentStderr": "red"
        }
      }`,
      "utf8",
    );
    writeFileSync(promptPath, "执行测试任务", "utf8");

    const proc = Bun.spawn(
      [
        bunBinary,
        "run",
        join(process.cwd(), "bin", "ralph-loop.ts"),
        "--agent",
        "opencode",
        "--prompt-file",
        promptPath,
        "--completion-promise",
        "COMPLETE",
        "--max-iterations",
        "1",
        "--",
        join(process.cwd(), "test", "fixtures", "fake-agents", "fake-agent-success.ts"),
      ],
      {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          FORCE_COLOR: "1",
          RALPH_OPENCODE_BINARY: bunBinary,
        },
      },
    );

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("\u001b[35m== Ralph Loop ==\u001b[0m");
    expect(stdout).toContain("\u001b[32mreceived: 执行测试任务\n<promise>COMPLETE</promise>\n\u001b[0m");
  });
});
