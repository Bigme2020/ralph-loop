import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  it("tsconfig 包含 openspec-wrapper 下的 TypeScript 文件", () => {
    const tsconfig = JSON.parse(readFileSync(join(process.cwd(), "tsconfig.json"), "utf8")) as {
      include?: string[];
    };

    expect(tsconfig.include).toContain("openspec-wrapper/**/*.ts");
  });
});
