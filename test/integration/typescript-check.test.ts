import { describe, expect, it } from "bun:test";

describe("typescript 配置检查", () => {
  it("在没有缺失类型定义时通过 Bun 和 process 全局变量的类型检查", async () => {
    const proc = Bun.spawn([Bun.which("bun")!, "x", "tsc", "--noEmit"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stderr).not.toContain("Cannot find name 'Bun'");
    expect(stderr).not.toContain("Cannot find name 'process'");
  }, { timeout: 30_000 });
});
